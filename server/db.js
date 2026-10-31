// Postgres data access, using Neon's serverless driver. This is the only file with SQL.
// The Pool talks to Neon over WebSockets, which supports full transactions (needed for orders).
import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import { MAX_ACTIVE_ORDERS_PER_USER } from '../shared/config.js';
import { orderTotals } from '../shared/pricing.js';
import { checkFulfilDate, today } from '../shared/dates.js';
import { HttpError } from './errors.js';
import { PRODUCTS } from './seed.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add your Neon connection string to .env (see .env.example).');
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (err) => console.error('Database connection error:', err.message));

// Idempotent, so it is safe to run on every start. There is no migration tool: a change to an
// existing table needs a manual ALTER (add it here too so fresh databases match).
//
// Tables are prefixed `bakery_` because this database is shared with other apps that already own
// `products` / `orders`; CREATE TABLE IF NOT EXISTS would silently skip a clashing name.
// stock >= 0 is the last line of defence against overselling; the locked decrement in
// createOrder is what produces a clean "only N left" message first.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS bakery_products (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    category    text NOT NULL,
    description text NOT NULL DEFAULT '',
    emoji       text NOT NULL DEFAULT '',
    price       numeric(10, 2) NOT NULL CHECK (price >= 0),
    stock       integer NOT NULL CHECK (stock >= 0),
    active      boolean NOT NULL DEFAULT true
  );

  CREATE TABLE IF NOT EXISTS bakery_orders (
    id           text PRIMARY KEY,
    user_id      text NOT NULL,
    status       text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'cancelled')),
    fulfillment  text NOT NULL CHECK (fulfillment IN ('pickup', 'delivery')),
    fulfil_date  date NOT NULL,
    contact      jsonb NOT NULL,
    address      jsonb,
    note         text NOT NULL DEFAULT '',
    payment      text NOT NULL,
    subtotal     numeric(10, 2) NOT NULL,
    delivery_fee numeric(10, 2) NOT NULL,
    tax          numeric(10, 2) NOT NULL,
    total        numeric(10, 2) NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS bakery_orders_user_idx ON bakery_orders (user_id, created_at DESC);

  -- Name, emoji and price are copied at order time so past orders don't change when the menu does.
  CREATE TABLE IF NOT EXISTS bakery_order_items (
    order_id   text NOT NULL REFERENCES bakery_orders(id) ON DELETE CASCADE,
    product_id text NOT NULL,
    name       text NOT NULL,
    emoji      text NOT NULL,
    price      numeric(10, 2) NOT NULL,
    qty        integer NOT NULL CHECK (qty > 0),
    PRIMARY KEY (order_id, product_id)
  );
`;

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Creates the tables and, on an empty database, loads the starter menu.
export async function init() {
  await pool.query(SCHEMA);
  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM bakery_products');
    if (rows[0].n > 0) return;
    for (const p of PRODUCTS) {
      await client.query(
        `INSERT INTO bakery_products (id, name, category, description, emoji, price, stock)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [p.id, p.name, p.category, p.description, p.emoji, p.price, p.stock],
      );
    }
    console.log(`Seeded ${PRODUCTS.length} products`);
  });
}

export async function ping() {
  await pool.query('SELECT 1');
}

// Postgres returns numeric columns as strings to avoid precision loss; prices fit in a JS number.
const toProduct = (r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  description: r.description,
  emoji: r.emoji,
  price: Number(r.price),
  stock: r.stock,
});

const toOrder = (r) => ({
  id: r.id,
  status: r.status,
  fulfillment: r.fulfillment,
  fulfilDate: r.fulfil_day,
  contact: r.contact,
  address: r.address,
  note: r.note,
  payment: r.payment,
  subtotal: Number(r.subtotal),
  deliveryFee: Number(r.delivery_fee),
  tax: Number(r.tax),
  total: Number(r.total),
  createdAt: r.created_at,
  items: (r.items ?? []).map((i) => ({ ...i, price: Number(i.price) })),
});

// Orders always come back with their lines; `fulfil_date` is selected as text so node-pg can't
// turn it into a local-time Date that shifts the day.
const ORDER_SELECT = `
  SELECT o.*, o.fulfil_date::text AS fulfil_day,
         COALESCE((SELECT json_agg(json_build_object('productId', i.product_id, 'name', i.name,
                                                      'emoji', i.emoji, 'price', i.price, 'qty', i.qty)
                                   ORDER BY i.name)
                     FROM bakery_order_items i WHERE i.order_id = o.id), '[]'::json) AS items
    FROM bakery_orders o`;

export async function getCategories() {
  const { rows } = await pool.query('SELECT DISTINCT category FROM bakery_products WHERE active ORDER BY category');
  return rows.map((r) => r.category);
}

export async function getProducts() {
  const { rows } = await pool.query('SELECT * FROM bakery_products WHERE active ORDER BY category, name');
  return rows.map(toProduct);
}

export async function getProduct(id) {
  const { rows } = await pool.query('SELECT * FROM bakery_products WHERE id = $1 AND active', [id]);
  return rows[0] ? toProduct(rows[0]) : null;
}

export async function getOrdersForUser(userId) {
  const { rows } = await pool.query(`${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [userId]);
  return rows.map(toOrder);
}

// Locks the products being bought, reprices from the database, checks the date window and stock,
// and records the order, all in one transaction. The client sends only what it wants
// ({ items: [{id, qty}], checkout }); any price or total it sends is ignored.
export async function createOrder({ userId, items, checkout }) {
  return withTransaction(async (client) => {
    const problem = checkFulfilDate(checkout.date);
    if (problem) throw new HttpError(400, problem, { date: problem });

    // Lock the rows being bought (in id order, so two checkouts can't deadlock) so that two
    // checkouts can't both take the last item.
    const { rows } = await client.query(
      'SELECT * FROM bakery_products WHERE id = ANY($1) AND active ORDER BY id FOR UPDATE',
      [items.map((i) => i.id)],
    );
    const products = new Map(rows.map((r) => [r.id, toProduct(r)]));
    const lines = items.map(({ id, qty }) => {
      const product = products.get(id);
      if (!product) throw new HttpError(400, 'An item in your cart is no longer on the menu. Remove it and try again.');
      if (qty > product.stock) {
        throw new HttpError(409, product.stock === 0
          ? `${product.name} is sold out`
          : `Only ${product.stock} ${product.name} left`);
      }
      return { product, qty };
    });

    const { rows: [{ n: active }] } = await client.query(
      `SELECT count(*)::int AS n FROM bakery_orders
        WHERE user_id = $1 AND status = 'placed' AND fulfil_date >= $2::date`,
      [userId, today()],
    );
    if (active >= MAX_ACTIVE_ORDERS_PER_USER) {
      throw new HttpError(409, `You can have at most ${MAX_ACTIVE_ORDERS_PER_USER} upcoming orders. Cancel one first.`);
    }

    const totals = orderTotals(lines.reduce((s, l) => s + l.product.price * l.qty, 0), checkout.fulfillment);
    const id = 'SC-' + randomUUID().slice(0, 8).toUpperCase();
    await client.query(
      `INSERT INTO bakery_orders (id, user_id, fulfillment, fulfil_date, contact, address, note, payment,
                                  subtotal, delivery_fee, tax, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, userId, checkout.fulfillment, checkout.date, checkout.contact, checkout.address, checkout.note,
        checkout.payment, totals.subtotal, totals.deliveryFee, totals.tax, totals.total],
    );
    for (const { product, qty } of lines) {
      await client.query('UPDATE bakery_products SET stock = stock - $2 WHERE id = $1', [product.id, qty]);
      await client.query(
        `INSERT INTO bakery_order_items (order_id, product_id, name, emoji, price, qty)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, product.id, product.name, product.emoji, product.price, qty],
      );
    }
    const { rows: [order] } = await client.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
    return toOrder(order);
  });
}

// Customers can only cancel their own orders, and only until the day before pickup/delivery
// (the bakery starts baking that morning). Cancelling puts the stock back.
// Idempotent: cancelling an already-cancelled order succeeds without restocking twice.
export async function cancelOrder(userId, id) {
  return withTransaction(async (client) => {
    const { rows: [o] } = await client.query(
      'SELECT *, fulfil_date::text AS fulfil_day FROM bakery_orders WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [id, userId],
    );
    // Someone else's order looks the same as a missing one.
    if (!o) throw new HttpError(404, 'Order not found');
    if (o.status === 'cancelled') {
      const { rows: [same] } = await client.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
      return toOrder(same);
    }
    if (o.fulfil_day <= today()) {
      throw new HttpError(409, 'This order is already being baked and can no longer be cancelled');
    }
    const { rows: lines } = await client.query(
      'SELECT product_id, qty FROM bakery_order_items WHERE order_id = $1 ORDER BY product_id',
      [id],
    );
    // Same id order as createOrder, so a cancel and a checkout can't deadlock.
    await client.query('SELECT 1 FROM bakery_products WHERE id = ANY($1) ORDER BY id FOR UPDATE', [lines.map((l) => l.product_id)]);
    for (const l of lines) {
      await client.query('UPDATE bakery_products SET stock = stock + $2 WHERE id = $1', [l.product_id, l.qty]);
    }
    await client.query(`UPDATE bakery_orders SET status = 'cancelled' WHERE id = $1`, [id]);
    const { rows: [updated] } = await client.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
    return toOrder(updated);
  });
}

export async function close() {
  await pool.end();
}
