import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { today } from '../../shared/dates';
import { cancelOrder, getOrders } from '../api/api';
import { formatDay, formatPrice } from '../lib/format';

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const justPlaced = useLocation().state?.justPlaced;

  useEffect(() => {
    getOrders().then(setOrders).catch((err) => setError(err.message));
  }, []);

  async function handleCancel(id) {
    if (!window.confirm('Cancel this order?')) return;
    setBusy(id);
    setError(null);
    try {
      const updated = await cancelOrder(id);
      setOrders((list) => list.map((o) => (o.id === id ? updated : o)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (!orders) return error ? <p className="alert">{error}</p> : <p className="muted">Loading orders…</p>;

  return (
    <>
      {justPlaced && (
        <div className="banner">🎉 Thank you! Your order <strong>{justPlaced}</strong> is in. We'll start baking.</div>
      )}
      <h1>Your orders</h1>
      {error && <p className="alert">{error}</p>}
      {orders.length === 0 ? (
        <div className="empty">
          <p>You haven't placed any orders yet.</p>
          <Link to="/" className="btn">See the menu</Link>
        </div>
      ) : (
        orders.map((o) => (
          <div key={o.id} className={`panel order ${o.id === justPlaced ? 'highlight' : ''} ${o.status}`}>
            <div className="order-head">
              <div>
                <strong>{o.id}</strong>
                <div className="muted small">Placed {new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <span className={`status ${o.status}`}>{o.status}</span>
              <strong>{formatPrice(o.total)}</strong>
            </div>
            {o.items.map((i) => (
              <div key={i.productId} className="mini-line">
                <span>{i.emoji} {i.name} × {i.qty}</span>
                <span>{formatPrice(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="muted small">
              {o.fulfillment === 'delivery'
                ? `Delivery to ${o.address.address}, ${o.address.city} ${o.address.zip}`
                : 'Pick up in store'}{' · '}{formatDay(o.fulfilDate)}
              {o.note && <><br />Note: {o.note}</>}
            </div>
            {o.status === 'placed' && o.fulfilDate > today() && (
              <button className="link-btn danger" disabled={busy === o.id} onClick={() => handleCancel(o.id)}>
                {busy === o.id ? 'Cancelling…' : 'Cancel order'}
              </button>
            )}
          </div>
        ))
      )}
    </>
  );
}
