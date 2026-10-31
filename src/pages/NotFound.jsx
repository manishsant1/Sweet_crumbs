import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="empty">
      <h2>Page not found</h2>
      <Link to="/" className="btn">See the menu</Link>
    </div>
  );
}
