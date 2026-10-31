import { Link } from 'react-router-dom';
import { FREE_DELIVERY_THRESHOLD } from '../../shared/config';
import { orderTotals } from '../../shared/pricing';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/format';
import Summary from '../components/Summary';

export default function Cart() {
  const { cart, subtotal, maxQty, updateQty, removeFromCart, clearCart } = useCart();

  if (cart.length === 0) {
    return (
      <div className="empty">
        <h2>Your cart is empty</h2>
        <Link to="/" className="btn">See the menu</Link>
      </div>
    );
  }

  const remaining = FREE_DELIVERY_THRESHOLD - subtotal;

  return (
    <>
      <h1>Your cart</h1>
      <div className="two-col">
        <div>
          {cart.map(({ product, qty }) => (
            <div key={product.id} className="line">
              <div className="thumb small">{product.emoji}</div>
              <div className="line-info">
                <Link to={`/product/${product.id}`}><strong>{product.name}</strong></Link>
                <span className="muted small">{formatPrice(product.price)} each</span>
              </div>
              <div className="qty">
                <button onClick={() => updateQty(product.id, qty - 1)} aria-label="Fewer">−</button>
                <span>{qty}</span>
                <button onClick={() => updateQty(product.id, qty + 1)} disabled={qty >= maxQty(product)} aria-label="More">+</button>
              </div>
              <strong className="line-total">{formatPrice(qty * product.price)}</strong>
              <button className="link-btn danger" onClick={() => removeFromCart(product.id)}>Remove</button>
            </div>
          ))}
          <button className="link-btn" onClick={clearCart}>Clear cart</button>
        </div>
        <aside className="panel">
          <h3>Order summary</h3>
          {remaining > 0 && <p className="note">Add {formatPrice(remaining)} more for free delivery.</p>}
          <Summary totals={orderTotals(subtotal, 'pickup')} />
          <p className="muted small">Delivery fee, if any, is added at checkout.</p>
          <Link to="/checkout" className="btn block">Checkout</Link>
        </aside>
      </div>
    </>
  );
}
