import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../App.css';

function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please provide both admin username and password.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('http://localhost:5000/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid admin credentials.');
      }

      // Store admin session separately from tourist session
      localStorage.setItem('tripPanaAdminToken', data.token);
      localStorage.setItem('tripPanaAdminUser', JSON.stringify(data.admin));

      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page admin-login-page">
      <Navbar />

      <main className="auth-container">
        <div className="auth-card admin-auth-card">
          <div className="admin-badge-top">Administrator Access</div>

          <div className="auth-header">
            <h2>TripPana Admin Portal</h2>
            <p>Sign in to access destination records, categories, and moderation</p>
          </div>

          {error && (
            <div className="auth-error-banner" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="adminUser">Admin Username</label>
              <input
                id="adminUser"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="adminPass">Password</label>
              <input
                id="adminPass"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn admin-submit-btn"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In as Administrator'}
            </button>
          </form>

          <div className="auth-footer">
            <Link to="/" className="auth-back-link">
              ← Return to public site
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminLoginPage;
