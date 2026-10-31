import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LABELS } from '../../shared/config';
import { signOut, useSession } from '../api/auth';
import { useCart } from '../context/CartContext';

export default function Header() {
  const { data: session } = useSession();
  const { cartCount } = useCart();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut().catch(() => {});
    navigate('/');
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">{LABELS.appEmoji} {LABELS.appName}</Link>
        <nav className="nav">
          <NavLink to="/" end>Menu</NavLink>
          <NavLink to="/orders">My orders</NavLink>
          <NavLink to="/cart">
            🛒 Cart {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </NavLink>
          {session ? (
            <>
              <span className="nav-user muted small">{session.user.name}</span>
              <button className="link-btn" onClick={handleSignOut}>Sign out</button>
            </>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
