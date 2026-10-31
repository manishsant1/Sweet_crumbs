import { useEffect, useMemo, useState } from 'react';
import { FREE_DELIVERY_THRESHOLD, LABELS } from '../../shared/config';
import { getCategories, getProducts } from '../api/api';
import ProductCard from '../components/ProductCard';
import { formatPrice } from '../lib/format';

const SORTS = {
  featured: () => 0,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  name: (a, b) => a.name.localeCompare(b.name),
};

export default function Home() {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    Promise.all([getProducts(), getCategories()])
      .then(([p, c]) => { setProducts(p); setCategories(c); })
      .catch((err) => setError(err.message));
  }, []);

  const visible = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => category === 'All' || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .filter((p) => !inStockOnly || p.stock > 0)
      .sort(SORTS[sort]);
  }, [products, query, category, sort, inStockOnly]);

  return (
    <>
      <section className="hero">
        <h1>{LABELS.tagline}</h1>
        <p>Order by tomorrow, pick up in store or get it delivered. Free delivery over {formatPrice(FREE_DELIVERY_THRESHOLD)}.</p>
      </section>

      <div className="toolbar">
        <input type="search" placeholder="Search the menu…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div className="chips">
        {['All', ...categories].map((c) => (
          <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="filters">
        <label className="check">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
          Available only
        </label>
      </div>

      {error ? (
        <p className="alert">{error}</p>
      ) : !products ? (
        <p className="muted">Loading the menu…</p>
      ) : visible.length === 0 ? (
        <p className="empty">Nothing on the menu matches. Try another search.</p>
      ) : (
        <>
          <p className="muted small">{visible.length} items</p>
          <div className="grid">{visible.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </>
      )}
    </>
  );
}
