import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProduct } from '../api/api';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/format';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, maxQty } = useCart();
  const [product, setProduct] = useState(undefined); // undefined = loading, null = not found
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let off = false;
    setProduct(undefined);
    setError(null);
    setQty(1);
    getProduct(id).then((p) => !off && setProduct(p)).catch((err) => !off && setError(err.message));
    return () => { off = true; };
  }, [id]);

  if (error) return <p className="alert">{error}</p>;
  if (product === undefined) return <p className="muted">Loading…</p>;
  if (product === null) return <p className="empty">We couldn't find that item. <Link to="/">Back to the menu</Link></p>;

  const soldOut = product.stock === 0;

  const handleAdd = () => {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="detail">
      <button className="link-btn" onClick={() => navigate(-1)}>← Back</button>
      <div className="detail-grid">
        <div className="thumb large">{product.emoji}</div>
        <div>
          <span className="muted">{product.category}</span>
          <h1>{product.name}</h1>
          <div className="price big">{formatPrice(product.price)}</div>
          <p>{product.description}</p>
          <p className={soldOut ? 'danger' : 'success'}>
            {soldOut ? 'Sold out' : product.stock < 10 ? `Only ${product.stock} left` : 'Available'}
          </p>
          {!soldOut && (
            <div className="row">
              <div className="qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Fewer">−</button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => Math.min(maxQty(product), q + 1))} aria-label="More">+</button>
              </div>
              <button className="btn" onClick={handleAdd}>{added ? '✓ Added' : 'Add to cart'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
