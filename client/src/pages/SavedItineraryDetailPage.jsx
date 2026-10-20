import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ItineraryMap from '../components/ItineraryMap';
import { useAuth } from '../context/AuthContext';
import '../App.css';

function SavedItineraryDetailPage() {
  const { id } = useParams();
  const { user, token, authLoading } = useAuth();
  const navigate = useNavigate();

  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchItinerary = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const response = await fetch(`http://localhost:5000/api/itineraries/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.status === 404) {
          throw new Error('Itinerary not found or you do not have permission to view it.');
        }

        if (!response.ok) {
          throw new Error('Failed to load itinerary details.');
        }

        const data = await response.json();
        setItinerary(data);
      } catch (err) {
        console.error('Error fetching itinerary:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchItinerary();
    }
  }, [id, token, authLoading]);

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${itinerary?.title}"?`)) {
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch(`http://localhost:5000/api/itineraries/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete itinerary.');
      }

      navigate('/my-itineraries');
    } catch (err) {
      alert(err.message);
      setDeleting(false);
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
    <div className="saved-detail-page">
      <Navbar />

      <main className="saved-detail-container">
        <Link to="/my-itineraries" className="back-link">
          ← Back to My Itineraries
        </Link>

        {authLoading || loading ? (
          <p className="message">Loading saved itinerary...</p>
        ) : !user ? (
          <div className="empty-itinerary">
            <h2>Sign in required</h2>
            <p>Please log in to your tourist account to view saved itineraries.</p>
            <Link to="/login" className="explore-button">
              Log In
            </Link>
          </div>
        ) : error || !itinerary ? (
          <div className="message">
            <p>{error || 'Itinerary not found.'}</p>
            <Link to="/my-itineraries">Return to My Itineraries</Link>
          </div>
        ) : (
          <>
            <div className="saved-detail-header">
              <div>
                <h1>{itinerary.title}</h1>
                <p className="saved-date">
                  Saved on{' '}
                  {new Date(itinerary.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <div className="saved-detail-actions">
                <button
                  type="button"
                  className="delete-saved-itinerary-btn"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : '🗑 Delete Itinerary'}
                </button>
              </div>
            </div>

            {/* Summary metrics */}
            <div className="itinerary-summary">
              <div className="summary-box">
                <span>Selected Places</span>
                <strong>{itinerary.places?.length || 0}</strong>
              </div>

              <div className="summary-box">
                <span>Total Distance</span>
                <strong>
                  {Number(itinerary.total_distance).toFixed(1)} km
                </strong>
              </div>

              <div className="summary-box">
                <span>Estimated Travel Time</span>
                <strong>{formatTime(itinerary.total_time)}</strong>
              </div>
            </div>

            {/* Leaflet Itinerary Map */}
            {itinerary.places && itinerary.places.length > 0 && (
              <section className="map-section">
                <div className="map-heading">
                  <h2>Saved Route Map</h2>
                  <p>Starting from Panadura and connecting your ordered attractions.</p>
                </div>

                <ItineraryMap places={itinerary.places} />
              </section>
            )}

            {/* Ordered Places List */}
            <div className="itinerary-list">
              <h2>Visit Stops in Order</h2>

              {itinerary.places?.map((place, index) => (
                <div className="itinerary-item" key={place.place_id}>
                  <div className="visit-number">{place.visit_order || index + 1}</div>

                  <img
                    src={
                      place.image_url ||
                      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'
                    }
                    alt={place.title}
                  />

                  <div className="itinerary-item-info">
                    <h3>{place.title}</h3>
                    <p>{place.location || place.address}</p>
                    <span className="category-badge">{place.category}</span>
                  </div>

                  <Link
                    to={`/places/${place.place_id}`}
                    className="details-button-link"
                    style={{ textDecoration: 'none' }}
                  >
                    View Place
                  </Link>
                </div>
              ))}
            </div>
          </>
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

export default SavedItineraryDetailPage;
