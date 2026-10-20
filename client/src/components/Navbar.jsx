import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isHome = location.pathname === '/';

  return (
    <nav className="navbar">
      <div className="logo">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          Trip<span>Pana</span>
        </Link>
      </div>

      <div className="nav-links">
        <Link to="/">Home</Link>
        {isHome ? (
          <a href="#places">Explore</a>
        ) : (
          <Link to="/#places">Explore</Link>
        )}
        <Link to="/itinerary">Itinerary</Link>
        {user && <Link to="/my-itineraries">My Itineraries</Link>}
        {user && <Link to="/favorites">Favourites</Link>}
        <Link to="/admin" className="nav-admin-link" title="Admin Moderation Portal">
          Admin
        </Link>

        {user ? (
          <div className="nav-user-section">
            <span className="nav-greeting" title={user.email}>
              Hi, <strong>{user.name.split(' ')[0]}</strong>
            </span>
            <button type="button" onClick={logout} className="nav-logout-btn">
              Logout
            </button>
          </div>
        ) : (
          <div className="nav-auth-links">
            <Link to="/login" className="nav-login-link">
              Login
            </Link>
            <Link to="/register" className="nav-register-btn">
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
