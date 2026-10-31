import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/format';

export default function ProductCard({ product }) {
  const { addToCart, cart } = useCart();
  const soldOut = product.stock === 0;
  const inCart = cart.find((l) => l.product.id === product.id)?.qty ?? 0;

  return (
    <div className="card">
      <Link to={`/product/${product.id}`} className="card-link">
        <div className="thumb">{product.emoji}</div>
        <div className="card-body">
          <span className="muted small">{product.category}</span>
          <h3>{product.name}</h3>
          <div className="price">{formatPrice(product.price)}</div>
          {!soldOut && product.stock < 10 && <span className="small danger">Only {product.stock} left</span>}
        </div>
      </Link>
      <button className="btn" disabled={soldOut} onClick={() => addToCart(product)}>
        {soldOut ? 'Sold out' : inCart ? `Add another (${inCart} in cart)` : 'Add to cart'}
      </button>
    </div>
  );
}
