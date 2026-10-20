import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import '../App.css';

function SavedItinerariesPage() {
  const { user, token, authLoading } = useAuth();
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const fetchItineraries = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('http://localhost:5000/api/itineraries', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve your saved itineraries.');
      }

      const data = await response.json();
      setItineraries(data);
    } catch (err) {
      console.error('Error fetching itineraries:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchItineraries();
    }
  }, [token, authLoading]);

  const handleDelete = async (itineraryId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/itineraries/${itineraryId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete itinerary.');
      }

      setItineraries((prev) => prev.filter((it) => it.itinerary_id !== itineraryId));
      setActionMessage(`"${title}" was deleted successfully.`);
      setTimeout(() => setActionMessage(''), 3000);
    } catch (err) {
      console.error('Error deleting itinerary:', err);
      alert(err.message);
    }
  };

  const formatTime = (minutes) => {
    const mins = Number(minutes) || 0;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;

    if (hours === 0) {
      return `${remMins} min`;
    }
    return `${hours} hr ${remMins} min`;
  };

  return (
    <div className="saved-itineraries-page">
      <Navbar />

      <main className="saved-itineraries-container">
        <div className="saved-header">
          <div>
            <h1>My Saved Itineraries</h1>
            <p>Your permanent collection of planned day trips around Panadura.</p>
          </div>

          <Link to="/itinerary" className="create-itinerary-nav-btn">
            + Plan New Itinerary
          </Link>
        </div>

        {actionMessage && (
          <div className="success-message" role="status">
            {actionMessage}
          </div>
        )}

        {error && (
          <div className="auth-error-banner" role="alert">
            {error}
          </div>
        )}

        {authLoading || loading ? (
          <p className="message">Loading your saved itineraries...</p>
        ) : !user ? (
          <div className="empty-itinerary">
            <h2>Sign in required</h2>
            <p>Please log in to your tourist account to view and manage saved itineraries.</p>
            <Link to="/login" className="explore-button">
              Log In
            </Link>
          </div>
        ) : itineraries.length === 0 ? (
          <div className="empty-itinerary">
            <h2>No saved itineraries yet</h2>
            <p>
              Use the TripPana One-Day Itinerary Planner to select places, generate an optimized route, and click &ldquo;Save Itinerary&rdquo; to store your trips permanently.
            </p>
            <Link to="/itinerary" className="explore-button">
              Open Itinerary Planner
            </Link>
          </div>
        ) : (
          <div className="saved-itineraries-grid">
            {itineraries.map((itinerary) => (
              <div key={itinerary.itinerary_id} className="saved-itinerary-card">
                <div className="saved-card-header">
                  <h3>{itinerary.title}</h3>
                  <span className="saved-card-date">
                    {new Date(itinerary.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                <div className="saved-card-metrics">
                  <div className="metric-pill">
                    <strong>{itinerary.place_count}</strong>
                    <span>{itinerary.place_count === 1 ? 'Stop' : 'Stops'}</span>
                  </div>

                  <div className="metric-pill">
                    <strong>{Number(itinerary.total_distance).toFixed(1)}</strong>
                    <span>km</span>
                  </div>

                  <div className="metric-pill">
                    <strong>{formatTime(itinerary.total_time)}</strong>
                    <span>Est. Time</span>
                  </div>
                </div>

                <div className="saved-card-footer">
                  <Link
                    to={`/my-itineraries/${itinerary.itinerary_id}`}
                    className="view-saved-btn"
                  >
                    View Route & Map
                  </Link>

                  <button
                    type="button"
                    className="delete-saved-btn"
                    onClick={() => handleDelete(itinerary.itinerary_id, itinerary.title)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer>
        <div className="footer-logo">TripPana</div>
        <p>Discover local attractions and plan your perfect day around Panadura.</p>
        <p className="copyright">&copy; 2026 TripPana</p>
      </footer>
    </div>
  );
}

export default SavedItinerariesPage;
