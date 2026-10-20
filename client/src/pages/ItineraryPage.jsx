import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ItineraryMap from '../components/ItineraryMap';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

import '../App.css';


function ItineraryPage() {
  const { user, token } = useAuth();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  // Save itinerary states
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [guestPrompt, setGuestPrompt] = useState(false);

  const PANADURA_LAT = 6.7132;
  const PANADURA_LNG = 79.9025;


  // =====================================================
  // LOAD ITINERARY (Guest & User LocalStorage fallback)
  // =====================================================

  useEffect(() => {
    const loadItinerary = async () => {
      try {
        const storedIds =
          JSON.parse(
            localStorage.getItem(
              'tripPanaItinerary'
            )
          ) || [];

        const loadedPlaces = [];

        for (const id of storedIds) {
          const response =
            await fetch(
              `http://localhost:5000/api/places/${id}`
            );

          if (response.ok) {
            const data = await response.json();
            loadedPlaces.push(data);
          }
        }

        setPlaces(loadedPlaces);
      } catch (error) {
        console.error('Error loading itinerary:', error);
      } finally {
        setLoading(false);
      }
    };

    loadItinerary();
  }, []);


  // =====================================================
  // HAVERSINE DISTANCE
  // =====================================================

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const toRadians = (degree) => degree * (Math.PI / 180);

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };


  // =====================================================
  // GENERATE OPTIMIZED ITINERARY
  // =====================================================

  const generateItinerary = () => {
    if (places.length === 0) {
      return;
    }

    const validPlaces = places.filter(
      (place) => place.latitude !== null && place.longitude !== null
    );

    const invalidPlaces = places.filter(
      (place) => place.latitude === null || place.longitude === null
    );

    let remaining = [...validPlaces];
    const optimized = [];

    let currentLat = PANADURA_LAT;
    let currentLng = PANADURA_LNG;
    let distanceTotal = 0;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      remaining.forEach((place, index) => {
        const distance = calculateDistance(
          currentLat,
          currentLng,
          Number(place.latitude),
          Number(place.longitude)
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      const nearestPlace = remaining[nearestIndex];
      optimized.push(nearestPlace);

      distanceTotal += nearestDistance;
      currentLat = Number(nearestPlace.latitude);
      currentLng = Number(nearestPlace.longitude);

      remaining.splice(nearestIndex, 1);
    }

    const finalOrder = [...optimized, ...invalidPlaces];

    setPlaces(finalOrder);
    setTotalDistance(distanceTotal);

    // Approximate urban travel speed = 30 km/h
    const estimatedMinutes = Math.round((distanceTotal / 30) * 60);
    setTotalTime(estimatedMinutes);
    setGenerated(true);

    localStorage.setItem(
      'tripPanaItinerary',
      JSON.stringify(finalOrder.map((place) => place.place_id))
    );
  };


  // =====================================================
  // REMOVE PLACE
  // =====================================================

  const removePlace = (placeId) => {
    const updatedPlaces = places.filter(
      (place) => place.place_id !== placeId
    );

    setPlaces(updatedPlaces);
    setGenerated(false);
    setTotalDistance(0);
    setTotalTime(0);

    localStorage.setItem(
      'tripPanaItinerary',
      JSON.stringify(updatedPlaces.map((place) => place.place_id))
    );
  };


  // =====================================================
  // CLEAR ITINERARY
  // =====================================================

  const clearItinerary = () => {
    localStorage.removeItem('tripPanaItinerary');

    setPlaces([]);
    setGenerated(false);
    setTotalDistance(0);
    setTotalTime(0);
    setShowSaveDialog(false);
    setSaveMessage('');
    setSaveError('');
  };


  // =====================================================
  // SAVE ITINERARY PERMANENTLY (Authenticated Tourist)
  // =====================================================

  const handleOpenSaveDialog = () => {
    if (!user || !token) {
      setGuestPrompt(true);
      setSaveMessage('');
      setSaveError('');
      return;
    }

    setGuestPrompt(false);
    setShowSaveDialog(true);
    setSaveTitle(`Panadura Visit (${places.length} places)`);
  };

  const handleSaveItinerary = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveMessage('');

    if (!saveTitle.trim()) {
      setSaveError('Please enter a title for your itinerary.');
      return;
    }

    if (places.length === 0) {
      setSaveError('Please add at least one attraction before saving.');
      return;
    }

    try {
      setSaving(true);

      const response = await fetch('http://localhost:5000/api/itineraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: saveTitle.trim(),
          total_distance: totalDistance,
          total_time: totalTime,
          places: places.map((p, index) => ({
            place_id: p.place_id,
            visit_order: index + 1
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save itinerary.');
      }

      setSaveMessage('Your itinerary has been saved permanently to your account!');
      setShowSaveDialog(false);
    } catch (err) {
      console.error('Error saving itinerary:', err);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };


  // =====================================================
  // FORMAT TIME
  // =====================================================

  const formatTime = (minutes) => {
    const mins = Number(minutes) || 0;
    const hours = Math.floor(mins / 60);
    const remainingMinutes = mins % 60;

    if (hours === 0) {
      return `${remainingMinutes} min`;
    }

    return `${hours} hr ${remainingMinutes} min`;
  };


  return (
    <div className="itinerary-page">
      <Navbar />

      <div className="itinerary-container">
        {/* PAGE HEADER */}
        <div className="itinerary-heading">
          <div>
            <h1>Your One-Day Itinerary</h1>
            <p>
              Select attractions, generate an optimized visit sequence, and save your plan.
            </p>
          </div>

          <div className="itinerary-header-actions">
            {places.length > 0 && (
              <button
                className="clear-button"
                onClick={clearItinerary}
              >
                Clear Itinerary
              </button>
            )}
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {guestPrompt && (
          <div className="login-prompt-banner" role="alert">
            Please <Link to="/login">log in</Link> or{' '}
            <Link to="/register">create an account</Link> to save this itinerary permanently.
          </div>
        )}

        {saveMessage && (
          <div className="success-message" role="status">
            {saveMessage}{' '}
            <Link to="/my-itineraries" className="saved-trip-inline-link">
              View in My Itineraries →
            </Link>
          </div>
        )}

        {saveError && (
          <div className="auth-error-banner" role="alert">
            {saveError}
          </div>
        )}

        {loading ? (
          <p className="message">Loading itinerary...</p>
        ) : places.length === 0 ? (
          <div className="empty-itinerary">
            <h2>No places added yet</h2>
            <p>Explore attractions and add places to create your trip.</p>
            <Link to="/" className="explore-button">
              Explore Places
            </Link>
          </div>
        ) : (
          <>
            {/* PLANNER ACTIONS */}
            <div className="planner-actions">
              <button
                className="generate-button"
                onClick={generateItinerary}
              >
                Generate Optimized Itinerary
              </button>

              <button
                type="button"
                className="save-itinerary-btn"
                onClick={handleOpenSaveDialog}
              >
                💾 Save Itinerary
              </button>
            </div>

            {/* SAVE ITINERARY MODAL / INLINE DIALOG */}
            {showSaveDialog && (
              <div className="save-dialog-card">
                <h3>Save Itinerary Permanently</h3>
                <p>Give your one-day visit a title to store it in your account.</p>

                <form onSubmit={handleSaveItinerary} className="save-dialog-form">
                  <div className="form-group">
                    <label htmlFor="itineraryTitleInput">Itinerary Title</label>
                    <input
                      id="itineraryTitleInput"
                      type="text"
                      placeholder="e.g. My Panadura Coast & Temple Day"
                      value={saveTitle}
                      onChange={(e) => setSaveTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="save-dialog-buttons">
                    <button
                      type="submit"
                      className="auth-submit-btn"
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Confirm & Save'}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setShowSaveDialog(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SUMMARY */}
            {generated && (
              <div className="itinerary-summary">
                <div className="summary-box">
                  <span>Selected Places</span>
                  <strong>{places.length}</strong>
                </div>

                <div className="summary-box">
                  <span>Estimated Distance</span>
                  <strong>{totalDistance.toFixed(1)} km</strong>
                </div>

                <div className="summary-box">
                  <span>Estimated Travel Time</span>
                  <strong>{formatTime(totalTime)}</strong>
                </div>
              </div>
            )}

            {/* MAP */}
            <section className="map-section">
              <div className="map-heading">
                <h2>Trip Map</h2>
                <p>Your selected attractions around Panadura.</p>
              </div>

              <ItineraryMap places={places} />
            </section>

            {/* PLACE LIST */}
            <div className="itinerary-list">
              <h2>Places in Visit Order</h2>

              {places.map((place, index) => (
                <div className="itinerary-item" key={place.place_id}>
                  <div className="visit-number">{index + 1}</div>

                  <img
                    src={
                      place.image_url ||
                      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'
                    }
                    alt={place.title}
                  />

                  <div className="itinerary-item-info">
                    <h3>{place.title}</h3>
                    <p>{place.location}</p>

                    {place.latitude !== null && place.longitude !== null ? (
                      <span>Map location available</span>
                    ) : (
                      <span className="coordinate-warning">
                        Map coordinates unavailable
                      </span>
                    )}
                  </div>

                  <button
                    className="remove-button"
                    onClick={() => removePlace(place.place_id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ItineraryPage;
