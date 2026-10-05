import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import '../App.css';

function PlaceDetails() {
  const { id } = useParams();

  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchPlace = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/places/${id}`
        );

        if (!response.ok) {
          throw new Error('Place not found');
        }

        const data = await response.json();
        setPlace(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlace();
  }, [id]);

  const addToItinerary = () => {
    const currentItinerary =
      JSON.parse(localStorage.getItem('tripPanaItinerary')) || [];

    const alreadyAdded = currentItinerary.includes(place.place_id);

    if (alreadyAdded) {
      setMessage('This place is already in your itinerary.');
      return;
    }

    const updatedItinerary = [
      ...currentItinerary,
      place.place_id
    ];

    localStorage.setItem(
      'tripPanaItinerary',
      JSON.stringify(updatedItinerary)
    );

    setMessage('Place added to your itinerary!');
  };

  if (loading) {
    return (
      <p className="message">
        Loading place details...
      </p>
    );
  }

  if (error || !place) {
    return (
      <div className="message">
        <p>{error || 'Place not found'}</p>

        <Link to="/">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="details-page">

      <nav className="navbar">

        <div className="logo">
          Trip<span>Pana</span>
        </div>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/">Explore</Link>
          <Link to="/itinerary">Itinerary</Link>
          <a href="#">Login</a>
        </div>

      </nav>

      <div className="details-container">

        <Link to="/" className="back-link">
          ← Back to Places
        </Link>

        <div className="details-card">

          <div className="details-image">

            <img
              src={
                place.image_url ||
                'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'
              }
              alt={place.title}
            />

          </div>

          <div className="details-content">

            <span className="details-category">
              {place.category}
            </span>

            <h1>
              {place.title}
            </h1>

            <p className="details-location">
              {place.address || place.location}
            </p>

            <div className="details-info-grid">

              <div className="info-box">
                <strong>Distance</strong>
                <span>
                  {place.distance_from_panadura !== null
                    ? `${place.distance_from_panadura} km`
                    : 'Unavailable'}
                </span>
              </div>

              <div className="info-box">
                <strong>Opening Hours</strong>
                <span>
                  {place.opening_hours || 'Unavailable'}
                </span>
              </div>

              <div className="info-box">
                <strong>Entry Fee</strong>
                <span>
                  {place.entry_fee || 'Unavailable'}
                </span>
              </div>

              <div className="info-box">
                <strong>Category</strong>
                <span>
                  {place.category || 'Unavailable'}
                </span>
              </div>

            </div>

            <section className="details-section">

              <h2>About this place</h2>

              <p>
                {place.description || 'No description available.'}
              </p>

            </section>

            <section className="details-section">

              <h2>Travel Tips</h2>

              <p>
                {place.travel_tips || 'No travel tips available.'}
              </p>

            </section>

            {message && (
              <div className="success-message">
                {message}
              </div>
            )}

            <div className="details-actions">

              <button onClick={addToItinerary}>
                Add to Itinerary
              </button>

              <button className="secondary-button">
                Add to Favourites
              </button>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default PlaceDetails;