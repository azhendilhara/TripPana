import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../App.css';

function AdminReviewsPage() {
  const [adminToken, setAdminToken] = useState(() => {
    return localStorage.getItem('tripPanaAdminToken') || '';
  });
  const [adminUser, setAdminUser] = useState(() => {
    const saved = localStorage.getItem('tripPanaAdminUser');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Admin login form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Moderation review states
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchAdminReviews = async (statusToFetch = filterStatus) => {
    if (!adminToken) return;

    try {
      setLoadingReviews(true);
      setActionError('');

      const url =
        statusToFetch === 'all'
          ? 'http://localhost:5000/api/admin/reviews?status=all'
          : `http://localhost:5000/api/admin/reviews?status=${statusToFetch}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      if (response.status === 401 || response.status === 403) {
        handleAdminLogout();
        throw new Error('Admin session expired. Please log in again.');
      }

      if (!response.ok) {
        throw new Error('Failed to load reviews for moderation.');
      }

      const data = await response.json();
      setReviews(data);
    } catch (err) {
      console.error('Error fetching admin reviews:', err);
      setActionError(err.message);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchAdminReviews(filterStatus);
    }
  }, [adminToken, filterStatus]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!username || !password) {
      setLoginError('Please enter both username and password.');
      return;
    }

    try {
      setLoginLoading(true);

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
        throw new Error(data.message || 'Admin login failed.');
      }

      localStorage.setItem('tripPanaAdminToken', data.token);
      localStorage.setItem('tripPanaAdminUser', JSON.stringify(data.admin));

      setAdminToken(data.token);
      setAdminUser(data.admin);
      setUsername('');
      setPassword('');
      setActionMessage('Admin logged in successfully.');
      setTimeout(() => setActionMessage(''), 3000);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('tripPanaAdminToken');
    localStorage.removeItem('tripPanaAdminUser');
    setAdminToken('');
    setAdminUser(null);
    setReviews([]);
  };

  const handleStatusUpdate = async (reviewId, newStatus) => {
    if (!adminToken) return;

    try {
      setActionError('');

      const response = await fetch(
        `http://localhost:5000/api/admin/reviews/${reviewId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            status: newStatus
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update review status.');
      }

      // Update state
      setActionMessage(`Review #${reviewId} has been marked as ${newStatus}.`);
      fetchAdminReviews(filterStatus);
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err) {
      console.error('Error updating status:', err);
      setActionError(err.message);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm(`Are you sure you want to permanently delete review #${reviewId}?`)) {
      return;
    }

    try {
      setActionError('');

      const response = await fetch(
        `http://localhost:5000/api/admin/reviews/${reviewId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete review.');
      }

      setActionMessage(`Review #${reviewId} was permanently deleted.`);
      fetchAdminReviews(filterStatus);
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err) {
      console.error('Error deleting review:', err);
      setActionError(err.message);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          className={i <= rating ? 'star-filled' : 'star-empty'}
        >
          ★
        </span>
      );
    }
    return stars;
  };

  return (
    <div className="admin-page">
      <Navbar />

      <main className="admin-container">
        {!adminToken ? (
          <div className="admin-login-card">
            <div className="auth-header">
              <h2>Administrator Login</h2>
              <p>Sign in with your admin credentials to moderate tourist reviews</p>
            </div>

            {loginError && (
              <div className="auth-error-banner" role="alert">
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="auth-form">
              <div className="form-group">
                <label htmlFor="adminUsername">Admin Username</label>
                <input
                  id="adminUsername"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="adminPassword">Password</label>
                <input
                  id="adminPassword"
                  type="password"
                  placeholder="Admin@123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loginLoading}
              >
                {loginLoading ? 'Authenticating...' : 'Sign In as Admin'}
              </button>
            </form>
          </div>
        ) : (
          <div className="admin-moderation-panel">
            <div className="admin-panel-header">
              <div>
                <h1>Review Moderation</h1>
                <p>
                  Logged in as <strong>{adminUser?.username || 'admin'}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={handleAdminLogout}
                className="nav-logout-btn"
              >
                Log Out Admin
              </button>
            </div>

            {actionMessage && (
              <div className="success-message" role="status">
                {actionMessage}
              </div>
            )}

            {actionError && (
              <div className="auth-error-banner" role="alert">
                {actionError}
              </div>
            )}

            {/* Filter Tabs */}
            <div className="admin-filter-tabs">
              <button
                type="button"
                className={`admin-tab-btn ${filterStatus === 'pending' ? 'active' : ''}`}
                onClick={() => setFilterStatus('pending')}
              >
                Pending Moderation
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${filterStatus === 'approved' ? 'active' : ''}`}
                onClick={() => setFilterStatus('approved')}
              >
                Approved
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${filterStatus === 'rejected' ? 'active' : ''}`}
                onClick={() => setFilterStatus('rejected')}
              >
                Rejected
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All Reviews
              </button>
            </div>

            {loadingReviews ? (
              <p className="message">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <div className="empty-itinerary">
                <h2>No {filterStatus !== 'all' ? filterStatus : ''} reviews found</h2>
                <p>
                  {filterStatus === 'pending'
                    ? 'All tourist reviews have been reviewed!'
                    : `No reviews matching status "${filterStatus}".`}
                </p>
              </div>
            ) : (
              <div className="admin-reviews-list">
                {reviews.map((rev) => (
                  <div key={rev.review_id} className="admin-review-card">
                    <div className="admin-card-header">
                      <div>
                        <span className="admin-rev-id">#{rev.review_id}</span>
                        <h3 className="admin-place-title">
                          <Link to={`/places/${rev.place_id}`}>
                            {rev.place_title}
                          </Link>
                        </h3>
                        <p className="admin-author-info">
                          By <strong>{rev.user_name}</strong> ({rev.user_email}) on{' '}
                          {new Date(rev.created_at).toLocaleDateString()} at{' '}
                          {new Date(rev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <span className={`status-pill status-${rev.status}`}>
                        {rev.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="admin-review-rating">
                      {renderStars(rev.rating)}
                      <span className="rating-num">({rev.rating} / 5)</span>
                    </div>

                    <p className="admin-review-comment">
                      &ldquo;{rev.comment}&rdquo;
                    </p>

                    <div className="admin-review-actions">
                      {rev.status !== 'approved' && (
                        <button
                          type="button"
                          className="btn-approve"
                          onClick={() => handleStatusUpdate(rev.review_id, 'approved')}
                        >
                          ✓ Approve
                        </button>
                      )}

                      {rev.status !== 'rejected' && (
                        <button
                          type="button"
                          className="btn-reject"
                          onClick={() => handleStatusUpdate(rev.review_id, 'rejected')}
                        >
                          ✕ Reject
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-delete"
                        onClick={() => handleDelete(rev.review_id)}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer>
        <div className="footer-logo">TripPana Administration</div>
        <p>Review moderation & destination management portal.</p>
        <p className="copyright">&copy; 2026 TripPana</p>
      </footer>
    </div>
  );
}

export default AdminReviewsPage;
