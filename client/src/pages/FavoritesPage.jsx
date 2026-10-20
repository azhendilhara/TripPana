import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import resolveImageUrl, { PLACEHOLDER_IMAGE } from '../utils/imageUrl';
import '../App.css';

function FavoritesPage() {
  const { user, token, authLoading } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const fetchFavorites = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('http://localhost:5000/api/favorites', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load favourites.');
      }

      const data = await response.json();
      setFavorites(data);
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchFavorites();
    }
  }, [token, authLoading]);

  const handleRemove = async (placeId, title) => {
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5000/api/favorites/${placeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove favourite.');
      }

      // Optimistically update list
      setFavorites((prev) => prev.filter((item) => item.place_id !== placeId));
      setActionMessage(`"${title}" was removed from your favourites.`);

      // Auto-clear message after 3 seconds
      setTimeout(() => setActionMessage(''), 3000);
    } catch (err) {
      console.error('Error removing favorite:', err);
      setError(err.message);
    }
  };

  const handleAddToItinerary = (placeId, title) => {
    const currentItinerary =
      JSON.parse(localStorage.getItem('tripPanaItinerary')) || [];

    if (currentItinerary.includes(placeId)) {
      setActionMessage(`"${title}" is already in your itinerary.`);
    } else {
      const updated = [...currentItinerary, placeId];
      localStorage.setItem('tripPanaItinerary', JSON.stringify(updated));
      setActionMessage(`"${title}" added to your itinerary!`);
    }

    setTimeout(() => setActionMessage(''), 3000);
  };

  return (
    <div className="favorites-page">
      <Navbar />

      <main className="favorites-container">
        <div className="favorites-header">
          <div>
            <h1>My Favourites</h1>
            <p>Your curated collection of attractions around Panadura.</p>
          </div>

          {user && !loading && (
            <span className="place-count">
              {favorites.length} {favorites.length === 1 ? 'place' : 'places'}
            </span>
          )}
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
          <p className="message">Loading your favourites...</p>
        ) : !user ? (
          <div className="empty-itinerary">
            <h2>Sign in to view your favourites</h2>
            <p>
              Log in to your TripPana tourist account to save attractions and access your favourites anytime.
            </p>
            <Link to="/login" className="explore-button">
              Log In
            </Link>
          </div>
        ) : favorites.length === 0 ? (
          <div className="empty-itinerary">
            <h2>No favourite places saved yet</h2>
            <p>
              Explore attractions in Panadura and click &ldquo;Add to Favourites&rdquo; to build your personal wishlist.
            </p>
            <Link to="/" className="explore-button">
              Explore Places
            </Link>
          </div>
        ) : (
          <div className="places-grid">
            {favorites.map((place) => (
              <article className="place-card" key={place.favorite_id}>
                <div className="image-container">
                  <img
                    src={resolveImageUrl(place.primary_image || place.image_url)}
                    alt={place.title}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                  <span className="category-badge">{place.category}</span>
                </div>

                <div className="place-content">
                  <h3>{place.title}</h3>

                  <p className="location">{place.location}</p>

                  <p className="description">{place.description}</p>

                  <div className="place-info">
                    <span>
                      {place.distance_from_panadura !== null
                        ? `${place.distance_from_panadura} km`
                        : 'Distance unavailable'}
                    </span>
                    <span>{place.entry_fee || 'Fee unavailable'}</span>
                  </div>

                  <div className="fav-card-actions">
                    <Link
                      to={`/places/${place.place_id}`}
                      className="details-button-link"
                    >
                      View Details
                    </Link>

                    <button
                      type="button"
                      className="fav-itinerary-btn"
                      onClick={() => handleAddToItinerary(place.place_id, place.title)}
                      title="Add to Itinerary"
                    >
                      + Itinerary
                    </button>

                    <button
                      type="button"
                      className="fav-remove-btn"
                      onClick={() => handleRemove(place.place_id, place.title)}
                      title="Remove from Favourites"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
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

export default FavoritesPage;
