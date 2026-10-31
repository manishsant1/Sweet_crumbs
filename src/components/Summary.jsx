import { TAX_RATE } from '../../shared/config';
import { formatPrice } from '../lib/format';

// `totals` comes from orderTotals() (estimate in the cart) or from the server (placed order).
export default function Summary({ totals, fulfillment }) {
  return (
    <dl className="summary">
      <dt>Subtotal</dt><dd>{formatPrice(totals.subtotal)}</dd>
      {fulfillment === 'delivery' && (
        <><dt>Delivery</dt><dd>{totals.deliveryFee === 0 ? 'Free' : formatPrice(totals.deliveryFee)}</dd></>
      )}
      <dt>Tax ({Math.round(TAX_RATE * 100)}%)</dt><dd>{formatPrice(totals.tax)}</dd>
      <dt className="total">Total</dt><dd className="total">{formatPrice(totals.total)}</dd>
    </dl>
  );
}
