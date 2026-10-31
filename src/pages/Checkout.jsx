import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { placeOrder } from '../api/api';
import { useSession } from '../api/auth';
import { load, save } from '../api/storage';
import { useCart } from '../context/CartContext';
import { earliestDate, latestDate } from '../../shared/dates';
import { orderTotals } from '../../shared/pricing';
import {
  ADDRESS_FIELDS, CONTACT_FIELDS, FULFILLMENTS, NOTE_MAX, PAYMENT_METHODS, validateCheckout,
} from '../../shared/validation';
import { formatPrice } from '../lib/format';
import Summary from '../components/Summary';

function Field({ field, form, setForm, errors }) {
  return (
    <label className={errors[field.name] ? 'invalid' : ''}>
      {field.label}
      <input
        type={field.type ?? 'text'}
        autoComplete={field.autoComplete}
        value={form[field.name] ?? ''}
        onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
      />
      {errors[field.name] && <span className="error">{errors[field.name]}</span>}
    </label>
  );
}

export default function Checkout() {
  const { cart, subtotal, clearCart } = useCart();
  const { data: session } = useSession();
  const navigate = useNavigate();
  // Remember the last contact/address details to make repeat orders faster.
  const [form, setForm] = useState(() => ({
    fullName: session?.user.name ?? '',
    email: session?.user.email ?? '',
    fulfillment: 'pickup',
    payment: 'card',
    date: earliestDate(),
    note: '',
    ...load('checkout', {}),
  }));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Don't bounce to /cart while the success navigation is in flight (clearCart empties the cart).
  if (cart.length === 0 && !submitting) return <Navigate to="/cart" replace />;

  const delivery = form.fulfillment === 'delivery';
  // Shown as an estimate; the server recalculates the total from its own prices.
  const totals = orderTotals(subtotal, form.fulfillment);

  // A saved date can be in the past by the time the customer returns; fall back to the earliest.
  const date = form.date >= earliestDate() ? form.date : earliestDate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const checkout = { ...form, date };
    const errs = validateCheckout(checkout);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    save('checkout', { ...form, date: undefined, note: undefined });
    try {
      const order = await placeOrder({
        items: cart.map(({ product, qty }) => ({ id: product.id, qty })),
        checkout,
      });
      clearCart();
      navigate('/orders', { state: { justPlaced: order.id } });
    } catch (err) {
      setErrors(err.details ?? {});
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1>Checkout</h1>
      <form className="two-col" onSubmit={handleSubmit} noValidate>
        <div className="panel">
          <h3>How would you like it?</h3>
          <div className="seg">
            {FULFILLMENTS.map(([value, label]) => (
              <label key={value} className={`check seg-opt ${form.fulfillment === value ? 'on' : ''}`}>
                <input type="radio" name="fulfillment" value={value} checked={form.fulfillment === value}
                  onChange={() => setForm({ ...form, fulfillment: value })} />
                {label}
              </label>
            ))}
          </div>
          <div className="form-grid">
            <label className={errors.date ? 'invalid' : ''}>
              {delivery ? 'Delivery date' : 'Pickup date'}
              <input type="date" min={earliestDate()} max={latestDate()} value={date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
              {errors.date && <span className="error">{errors.date}</span>}
            </label>
          </div>

          <h3>Your details</h3>
          <div className="form-grid">
            {CONTACT_FIELDS.map((f) => <Field key={f.name} field={f} form={form} setForm={setForm} errors={errors} />)}
          </div>

          {delivery && (
            <>
              <h3>Delivery address</h3>
              <div className="form-grid">
                {ADDRESS_FIELDS.map((f) => <Field key={f.name} field={f} form={form} setForm={setForm} errors={errors} />)}
              </div>
            </>
          )}

          <label className={`field-wide ${errors.note ? 'invalid' : ''}`}>
            Note for the baker (optional)
            <input value={form.note ?? ''} maxLength={NOTE_MAX} placeholder="Allergies, a message on the cake…"
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
            {errors.note && <span className="error">{errors.note}</span>}
          </label>

          <h3>Payment</h3>
          <p className="muted small">This is a demo. No real payment is taken and no card details are collected.</p>
          {PAYMENT_METHODS.map(([value, label]) => (
            <label key={value} className="check">
              <input type="radio" name="payment" value={value} checked={form.payment === value}
                onChange={() => setForm({ ...form, payment: value })} />
              {label}
            </label>
          ))}
        </div>
        <aside className="panel">
          <h3>Your order</h3>
          {cart.map(({ product, qty }) => (
            <div key={product.id} className="mini-line">
              <span>{product.emoji} {product.name} × {qty}</span>
              <span>{formatPrice(product.price * qty)}</span>
            </div>
          ))}
          <Summary totals={totals} fulfillment={form.fulfillment} />
          {submitError && <p className="alert">{submitError}</p>}
          <button type="submit" className="btn block" disabled={submitting}>
            {submitting ? 'Placing order…' : `Place order · ${formatPrice(totals.total)}`}
          </button>
          <Link to="/cart" className="link-btn">← Back to cart</Link>
        </aside>
      </form>
    </>
  );
}
