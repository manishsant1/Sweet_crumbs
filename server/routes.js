import express from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';
import * as db from './db.js';
import { HttpError } from './errors.js';
import { MAX_QTY_PER_LINE } from '../shared/config.js';
import { ADDRESS_FIELDS, CONTACT_FIELDS, validateCheckout } from '../shared/validation.js';

const router = express.Router();

// The signed-in user's id, from the Better Auth session cookie. Browsing is public; everything
// that touches a person's orders goes through here. Records are always scoped by this id.
async function requireUser(req) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new HttpError(401, 'Please sign in to continue');
  return session.user.id;
}

// Cart lines arrive as [{ id, qty }]. Merge duplicate ids and reject anything malformed.
function parseItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your cart is empty');
  if (items.length > 100) throw new HttpError(400, 'Too many items in one order');
  const qtyById = new Map();
  for (const item of items) {
    const { id, qty } = item ?? {};
    if (typeof id !== 'string' || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      throw new HttpError(400, 'Invalid item in cart');
    }
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);
  }
  const merged = [...qtyById].map(([id, qty]) => ({ id, qty }));
  if (merged.some((l) => l.qty > MAX_QTY_PER_LINE)) throw new HttpError(400, `At most ${MAX_QTY_PER_LINE} of one item per order`);
  return merged;
}

const pick = (fields, source) => Object.fromEntries(fields.map((f) => [f.name, source[f.name].trim()]));

router.get('/health', async (req, res) => {
  await db.ping();
  res.json({ ok: true });
});

router.get('/categories', async (req, res) => res.json(await db.getCategories()));

router.get('/products', async (req, res) => res.json(await db.getProducts()));

router.get('/products/:id', async (req, res) => {
  const product = await db.getProduct(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(product);
});

router.get('/orders', async (req, res) => {
  res.json(await db.getOrdersForUser(await requireUser(req)));
});

router.post('/orders', async (req, res) => {
  const userId = await requireUser(req);
  const { items, checkout } = req.body ?? {};
  const form = checkout && typeof checkout === 'object' ? checkout : {};

  const lines = parseItems(items);
  const errors = validateCheckout(form);
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);

  // Prices, stock and totals are decided by the database, never by the request. Keep only the
  // known fields, trimmed.
  const delivery = form.fulfillment === 'delivery';
  const order = await db.createOrder({
    userId,
    items: lines,
    checkout: {
      fulfillment: form.fulfillment,
      date: form.date,
      payment: form.payment,
      note: typeof form.note === 'string' ? form.note.trim() : '',
      contact: pick(CONTACT_FIELDS, form),
      address: delivery ? pick(ADDRESS_FIELDS, form) : null,
    },
  });
  res.status(201).json(order);
});

router.post('/orders/:id/cancel', async (req, res) => {
  res.json(await db.cancelOrder(await requireUser(req), req.params.id));
});

router.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards errors thrown in handlers (sync or async) to this handler.
router.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

export default router;
