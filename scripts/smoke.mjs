// End-to-end check of auth and the ordering rules against a RUNNING server (npm run dev / npm start).
//   npm run smoke                      -> http://localhost:3000
//   BASE_URL=https://my-app.onrender.com npm run smoke
// It creates throwaway accounts, places real orders (cancelled again, which restores stock), races
// two checkouts for the last of an item, and deletes the accounts at the end - even on failure.
import assert from 'node:assert/strict';
import { MAX_ACTIVE_ORDERS_PER_USER } from '../shared/config.js';
import { addDays, today } from '../shared/dates.js';
import { orderTotals } from '../shared/pricing.js';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const password = 'smoke-' + Math.random().toString(36).slice(2) + 'Aa1';
const date = addDays(today(), 2);
const contact = { fullName: 'Smoke Test', email: 'smoke@example.com', phone: '555 010 1234' };
const pickup = { fulfillment: 'pickup', date, payment: 'cash', ...contact };
const delivery = { fulfillment: 'delivery', date, payment: 'cash', ...contact, address: '1 Test St', city: 'Testville', zip: '12345' };

// A "browser": remembers cookies between calls.
function makeUser(label) {
  const jar = new Map();
  const email = `smoke-${label}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.com`;
  async function call(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + '/api' + path, {
      method,
      // Better Auth rejects cookie-bearing writes whose Origin is not the app's own address.
      headers: { 'Content-Type': 'application/json', Origin: BASE, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body && JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      pair.slice(i + 1) ? jar.set(pair.slice(0, i), pair.slice(i + 1)) : jar.delete(pair.slice(0, i));
    }
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  return { email, call, signedUp: false };
}
const step = (name) => console.log('•', name);
const anon = makeUser('anon');
const alice = makeUser('alice');
const bob = makeUser('bob');
const users = [alice, bob];
const placed = []; // [user, orderId] so the finally block can cancel whatever is left

const order = (u, items, checkout) => u.call('/orders', { method: 'POST', body: { items, checkout } });
const stockOf = async (id) => (await anon.call(`/products/${id}`)).data.stock;
async function place(u, items, checkout) {
  const r = await order(u, items, checkout);
  if (r.status === 201) placed.push([u, r.data.id]);
  return r;
}

try {
  step('health');
  assert.equal((await anon.call('/health')).status, 200);

  step('menu is public');
  const { data: products } = await anon.call('/products');
  assert.ok(products.length > 0, 'no products (is the database seeded?)');
  assert.ok((await anon.call('/categories')).data.length > 0);
  assert.equal((await anon.call('/products/nope')).status, 404);
  const cheap = products.filter((p) => p.stock >= 30).sort((a, b) => a.price - b.price)[0];
  assert.ok(cheap, 'need a product with stock >= 30');

  step('orders need a signed-in user (401)');
  assert.equal((await anon.call('/orders')).status, 401);
  assert.equal((await order(anon, [{ id: cheap.id, qty: 1 }], pickup)).status, 401);
  assert.equal((await anon.call('/orders/SC-NOPE/cancel', { method: 'POST' })).status, 401);

  step('sign up, session, wrong password refused');
  for (const u of users) {
    // Production rate-limits sign-ups to a few per 10 seconds; wait the window out rather than fail.
    let up;
    for (let attempt = 0; attempt < 6; attempt++) {
      up = await u.call('/auth/sign-up/email', { method: 'POST', body: { name: 'Smoke ' + u.email.split('-')[1], email: u.email, password } });
      if (up.status !== 429) break;
      await new Promise((r) => setTimeout(r, 11000));
    }
    assert.equal(up.status, 200, JSON.stringify(up.data));
    u.signedUp = true;
  }
  assert.equal((await alice.call('/auth/get-session')).data?.user?.email, alice.email);
  assert.notEqual((await anon.call('/auth/sign-in/email', { method: 'POST', body: { email: alice.email, password: password + 'x' } })).status, 200);
  assert.equal((await anon.call('/auth/sign-up/email', { method: 'POST', body: { name: 'x', email: 'short@example.com', password: 'short' } })).status, 400, 'short password');

  step('rejects bad input (400, never 500)');
  const item = { id: cheap.id, qty: 1 };
  for (const [what, items, checkout] of [
    ['empty cart', [], pickup],
    ['null body parts', null, null],
    ['zero qty', [{ id: cheap.id, qty: 0 }], pickup],
    ['fractional qty', [{ id: cheap.id, qty: 1.5 }], pickup],
    ['huge qty', [{ id: cheap.id, qty: 999 }], pickup],
    ['null line', [null], pickup],
    ['unknown product', [{ id: 'nope', qty: 1 }], pickup],
    ['date today (needs notice)', [item], { ...pickup, date: today() }],
    ['date too far ahead', [item], { ...pickup, date: addDays(today(), 60) }],
    ['bad date', [item], { ...pickup, date: '2026-02-30' }],
    ['missing contact', [item], { fulfillment: 'pickup', date, payment: 'cash' }],
    ['bad payment', [item], { ...pickup, payment: 'bitcoin' }],
    ['delivery without address', [item], { ...pickup, fulfillment: 'delivery' }],
  ]) {
    const r = await order(alice, items, checkout);
    assert.equal(r.status, 400, `${what}: ${r.status} ${JSON.stringify(r.data)}`);
  }
  const noAddr = await order(alice, [item], { ...pickup, fulfillment: 'delivery' });
  assert.ok(noAddr.data.details.address, 'field errors are returned per field');

  step('order is repriced from the database; client totals and prices are ignored');
  const before = await stockOf(cheap.id);
  const body = { items: [{ id: cheap.id, qty: 2 }, { id: cheap.id, qty: 1 }], checkout: { ...pickup, total: 0.01 }, total: 0.01, price: 0.01 };
  const r1 = await alice.call('/orders', { method: 'POST', body });
  assert.equal(r1.status, 201, JSON.stringify(r1.data));
  placed.push([alice, r1.data.id]);
  assert.equal(r1.data.items.length, 1, 'duplicate lines merge');
  assert.equal(r1.data.items[0].qty, 3);
  assert.equal(r1.data.total, orderTotals(cheap.price * 3, 'pickup').total);
  assert.equal(r1.data.address, null);
  assert.equal(await stockOf(cheap.id), before - 3, 'stock decremented');

  step('delivery adds the fee below the free-delivery threshold');
  const d = await place(alice, [item], delivery);
  assert.equal(d.status, 201, JSON.stringify(d.data));
  assert.equal(d.data.deliveryFee, orderTotals(cheap.price, 'delivery').deliveryFee);
  assert.equal(d.data.total, orderTotals(cheap.price, 'delivery').total);

  step('cannot order more than is in stock (409)');
  const soldOut = products.find((p) => p.stock === 0);
  if (soldOut) {
    const r = await order(alice, [{ id: soldOut.id, qty: 1 }], pickup);
    assert.equal(r.status, 409);
    assert.match(r.data.error, /sold out/i);
  }

  step('two checkouts racing for the last of an item: one wins, one gets 409');
  const scarce = products.filter((p) => p.stock > 0 && p.stock <= 24).sort((a, b) => a.stock - b.stock)[0];
  if (scarce) {
    const s0 = await stockOf(scarce.id);
    assert.equal((await order(alice, [{ id: scarce.id, qty: s0 + 1 }], pickup)).status, s0 + 1 > 24 ? 400 : 409, 'more than in stock');
    const racing = [alice, bob].map((u) => order(u, [{ id: scarce.id, qty: s0 }], pickup));
    const results = await Promise.all(racing);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409], JSON.stringify(results.map((r) => r.data)));
    const winnerIdx = results.findIndex((r) => r.status === 201);
    placed.push([users[winnerIdx], results[winnerIdx].data.id]);
    assert.equal(await stockOf(scarce.id), 0);
    // Cancel the winner and the stock comes back, exactly once.
    const win = placed.pop();
    assert.equal((await win[0].call(`/orders/${win[1]}/cancel`, { method: 'POST' })).status, 200);
    assert.equal((await win[0].call(`/orders/${win[1]}/cancel`, { method: 'POST' })).status, 200, 'cancel is idempotent');
    assert.equal(await stockOf(scarce.id), s0, 'stock restored once, not twice');
  } else console.log('  (skipped: no product with limited stock)');

  step('only the owner sees and can cancel an order');
  assert.equal((await bob.call('/orders')).data.length, 0);
  assert.equal((await bob.call(`/orders/${r1.data.id}/cancel`, { method: 'POST' })).status, 404);
  assert.ok((await alice.call('/orders')).data.some((o) => o.id === r1.data.id && o.items.length === 1));

  step('cancel puts the stock back');
  const mid = await stockOf(cheap.id);
  const c = await alice.call(`/orders/${r1.data.id}/cancel`, { method: 'POST' });
  assert.equal(c.data.status, 'cancelled');
  assert.equal(await stockOf(cheap.id), mid + 3);

  step(`per-user cap of ${MAX_ACTIVE_ORDERS_PER_USER} upcoming orders (409)`);
  const active = (await bob.call('/orders')).data.filter((o) => o.status === 'placed').length;
  for (let i = active; i < MAX_ACTIVE_ORDERS_PER_USER; i++) {
    assert.equal((await place(bob, [item], pickup)).status, 201);
  }
  assert.equal((await order(bob, [item], pickup)).status, 409);

  step('sign out ends the session; sign in again works');
  await alice.call('/auth/sign-out', { method: 'POST', body: {} });
  assert.equal((await alice.call('/orders')).status, 401);
  assert.equal((await alice.call('/auth/sign-in/email', { method: 'POST', body: { email: alice.email, password } })).status, 200);
  assert.equal((await alice.call('/orders')).status, 200);
} finally {
  step('clean up: cancel leftover orders, delete the throwaway accounts');
  for (const [u, id] of placed) await u.call(`/orders/${id}/cancel`, { method: 'POST' }).catch(() => {});
  for (const u of users) {
    if (u.signedUp) await u.call('/auth/delete-user', { method: 'POST', body: { password } }).catch(() => {});
  }
}
assert.equal((await alice.call('/orders')).status, 401, 'deleted account has no session');
console.log('\nAll checks passed. Smoke orders were cancelled and the smoke accounts deleted.');
