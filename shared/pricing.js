// Used by both the browser (to show totals) and the server (to charge them), so the two agree.
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, TAX_RATE } from './config.js';

const round2 = (n) => Math.round(n * 100) / 100;

export function orderTotals(subtotal, fulfillment) {
  const deliveryFee =
    fulfillment === 'delivery' && subtotal > 0 && subtotal < FREE_DELIVERY_THRESHOLD ? DELIVERY_FEE : 0;
  const tax = subtotal * TAX_RATE;
  return {
    subtotal: round2(subtotal),
    deliveryFee,
    tax: round2(tax),
    total: round2(subtotal + deliveryFee + tax),
  };
}
