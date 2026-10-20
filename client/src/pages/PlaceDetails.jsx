import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import resolveImageUrl, { PLACEHOLDER_IMAGE } from '../utils/imageUrl';
import '../App.css';

function PlaceDetails() {
  const { id } = useParams();
  const { user, token } = useAuth();

  const [place, setPlace] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);

  // Reviews states
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ totalReviews: 0, averageRating: 0 });
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [ratingInput, setRatingInput] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [commentInput, setCommentInput] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewError, setReviewError] = useState('');

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

  // Deduplicated list of gallery images
  const galleryImages = (() => {
    if (!place) return [];

    if (Array.isArray(place.images) && place.images.length > 0) {
      return place.images.map((img, idx) => ({
        id: img.image_id || `img-${idx}`,
        src: resolveImageUrl(img.full_url || img.image_path),
        is_primary: Boolean(img.is_primary),
        alt: `${place.title} - photo ${idx + 1}`
      }));
    }

    if (place.image_url && typeof place.image_url === 'string' && place.image_url.trim()) {
      return [{
        id: 'legacy-cover',
        src: resolveImageUrl(place.image_url),
        is_primary: true,
        alt: place.title
      }];
    }

    return [];
  })();

  // Lightbox keyboard navigation & body scroll locking
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        if (galleryImages.length > 1) {
          setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
        }
      } else if (e.key === 'ArrowLeft') {
        if (galleryImages.length > 1) {
          setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [lightboxIndex, galleryImages.length]);

  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const response = await fetch(
        `http://localhost:5000/api/places/${id}/reviews`
      );

      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        setReviewStats(data.stats || { totalReviews: 0, averageRating: 0 });
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchPlace();
    fetchReviews();
  }, [id]);

  // Check favorite status for logged in tourist
  useEffect(() => {
    if (!token || !id) {
      setIsFavorite(false);
      return;
    }

    const checkFavoriteStatus = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/favorites/check/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setIsFavorite(data.isFavorite);
        }
      } catch (err) {
        console.error('Error checking favorite status:', err);
      }
    };

    checkFavoriteStatus();
  }, [id, token]);

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

  const toggleFavorite = async () => {
    if (!user || !token) {
      setLoginPrompt(true);
      setMessage('');
      return;
    }

    setFavLoading(true);
    setLoginPrompt(false);

    try {
      if (isFavorite) {
        const response = await fetch(
          `http://localhost:5000/api/favorites/${place.place_id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to remove from favourites.');
        }

        setIsFavorite(false);
        setMessage('Place removed from your favourites!');
      } else {
        const response = await fetch(
          'http://localhost:5000/api/favorites',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              place_id: place.place_id
            })
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to add to favourites.');
        }

        setIsFavorite(true);
        setMessage('Place added to your favourites!');
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setFavLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    setReviewSuccess('');

    if (!user || !token) {
      setReviewError('Please log in to submit a review.');
      return;
    }

    const trimmedComment = commentInput.trim();
    if (trimmedComment.length < 3) {
      setReviewError('Please write at least 3 characters in your review comment.');
      return;
    }

    try {
      setSubmittingReview(true);

      const response = await fetch('http://localhost:5000/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          place_id: place.place_id,
          rating: ratingInput,
          comment: trimmedComment
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit review.');
      }

      setReviewSuccess(
        'Thank you! Your review has been submitted and will appear here once approved by an administrator.'
      );
      setCommentInput('');
      setRatingInput(5);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          className={i <= Math.round(rating) ? 'star-filled' : 'star-empty'}
        >
          ★
        </span>
      );
    }
    return stars;
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

      <Navbar />

      <div className="details-container">

        <Link to="/" className="back-link">
          ← Back to Places
        </Link>

        <div className="details-card">

          <div className="details-image">
            <img
              src={resolveImageUrl(place.primary_image || place.image_url)}
              alt={place.title}
              className="details-hero-img"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = PLACEHOLDER_IMAGE;
              }}
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

            {loginPrompt && (
              <div className="login-prompt-banner" role="alert">
                Please <Link to="/login">log in</Link> to save places to your favourites.
              </div>
            )}

            {message && (
              <div className="success-message" role="status">
                {message}
              </div>
            )}

            <div className="details-actions">

              <button onClick={addToItinerary}>
                Add to Itinerary
              </button>

              <button
                type="button"
                className={`secondary-button ${isFavorite ? 'favorited-active' : ''}`}
                onClick={toggleFavorite}
                disabled={favLoading}
              >
                {favLoading
                  ? 'Updating...'
                  : isFavorite
                    ? '★ Remove from Favourites'
                    : '☆ Add to Favourites'}
              </button>

            </div>

          </div>

        </div>

        {/* ===============================================
            DEDICATED PHOTO GALLERY SECTION
            =============================================== */}
        {galleryImages.length > 0 && (
          <section className="place-gallery-section" aria-label="Photo gallery">
            <div className="gallery-section-header">
              <h2>Photo Gallery</h2>
              <p>
                Explore visual highlights of {place.title} ({galleryImages.length}{' '}
                {galleryImages.length === 1 ? 'photo' : 'photos'}). Click any photo to view full size.
              </p>
            </div>

            <div className="place-gallery-grid">
              {galleryImages.map((img, index) => (
                <div
                  key={img.id}
                  className="gallery-grid-item"
                  onClick={() => setLightboxIndex(index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setLightboxIndex(index);
                    }
                  }}
                  aria-label={`View photo ${index + 1} of ${galleryImages.length}`}
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="gallery-grid-img"
                    loading="lazy"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                  <div className="gallery-item-overlay">
                    <span className="gallery-zoom-icon">🔍</span>
                  </div>
                  {img.is_primary && (
                    <span className="gallery-item-primary-tag">★ Cover Photo</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===============================================
            REVIEWS & VISITOR RATINGS SECTION
            =============================================== */}
        <section className="reviews-wrapper">
          <div className="reviews-header">
            <div>
              <h2>Visitor Reviews & Ratings</h2>
              <p>Honest feedback from tourists who visited {place.title}.</p>
            </div>

            <div className="reviews-summary-badge">
              <div className="summary-stars">
                {renderStars(reviewStats.averageRating)}
              </div>
              <span className="summary-number">
                {reviewStats.totalReviews > 0
                  ? `${reviewStats.averageRating} / 5`
                  : 'No ratings yet'}
              </span>
              <span className="summary-count">
                ({reviewStats.totalReviews}{' '}
                {reviewStats.totalReviews === 1 ? 'approved review' : 'approved reviews'})
              </span>
            </div>
          </div>

          {/* Review Submission Form Card */}
          <div className="review-form-card">
            <h3>Write a Review</h3>

            {!user ? (
              <div className="login-prompt-banner" role="status">
                Want to share your experience? Please <Link to="/login">Log In</Link> or{' '}
                <Link to="/register">Create an Account</Link> to submit a review.
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="review-form">
                {reviewSuccess && (
                  <div className="success-message" role="status">
                    {reviewSuccess}
                  </div>
                )}

                {reviewError && (
                  <div className="auth-error-banner" role="alert">
                    {reviewError}
                  </div>
                )}

                <div className="rating-select-group">
                  <label>Your Rating:</label>
                  <div
                    className="interactive-stars"
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        className={`star-select-btn ${
                          (hoverRating || ratingInput) >= star ? 'selected' : ''
                        }`}
                        onClick={() => setRatingInput(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        title={`${star} star${star > 1 ? 's' : ''}`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="rating-label">
                      {hoverRating || ratingInput} / 5 (
                      {(hoverRating || ratingInput) === 1
                        ? 'Poor'
                        : (hoverRating || ratingInput) === 2
                        ? 'Fair'
                        : (hoverRating || ratingInput) === 3
                        ? 'Good'
                        : (hoverRating || ratingInput) === 4
                        ? 'Very Good'
                        : 'Excellent'}
                      )
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reviewComment">Your Feedback:</label>
                  <textarea
                    id="reviewComment"
                    rows="4"
                    placeholder="Describe your visit, sights, crowds, or helpful tips for other tourists..."
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    required
                  ></textarea>
                  <span className="char-count">
                    {commentInput.length} / 1500 characters
                  </span>
                </div>

                <div className="review-form-actions">
                  <p className="moderation-notice">
                    ℹ New submissions are reviewed by an administrator before appearing publicly.
                  </p>
                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={submittingReview}
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Approved Reviews List */}
          <div className="reviews-list-container">
            <h3>Approved Reviews ({reviews.length})</h3>

            {loadingReviews ? (
              <p className="message">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <div className="no-reviews-box">
                <p>No approved reviews yet for this attraction.</p>
                <p className="subtext">
                  Be the first visitor to share your experience!
                </p>
              </div>
            ) : (
              <div className="approved-reviews-list">
                {reviews.map((rev) => (
                  <article key={rev.review_id} className="visitor-review-card">
                    <div className="review-card-top">
                      <div>
                        <strong className="reviewer-name">{rev.user_name}</strong>
                        <span className="review-verified-badge">Verified Tourist</span>
                      </div>
                      <time className="review-date">
                        {new Date(rev.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </time>
                    </div>

                    <div className="review-rating-stars">
                      {renderStars(rev.rating)}
                    </div>

                    <p className="review-text">{rev.comment}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>

      {/* ===============================================
          FULL-IMAGE LIGHTBOX VIEWER
          =============================================== */}
      {lightboxIndex !== null && galleryImages[lightboxIndex] && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Full size photo viewer"
        >
          <button
            type="button"
            className="lightbox-close-btn"
            onClick={() => setLightboxIndex(null)}
            title="Close viewer (Esc)"
            aria-label="Close photo viewer"
          >
            ✕
          </button>

          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                className="lightbox-nav-btn lightbox-prev-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
                }}
                title="Previous photo (Left Arrow)"
                aria-label="Previous photo"
              >
                ‹
              </button>

              <button
                type="button"
                className="lightbox-nav-btn lightbox-next-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
                }}
                title="Next photo (Right Arrow)"
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          )}

          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-img-wrap">
              <img
                src={galleryImages[lightboxIndex].src}
                alt={galleryImages[lightboxIndex].alt}
                className="lightbox-img"
              />
            </div>

            <div className="lightbox-info-bar">
              <span className="lightbox-counter">
                {lightboxIndex + 1} / {galleryImages.length}
              </span>
              {galleryImages[lightboxIndex].is_primary && (
                <span className="lightbox-primary-badge">★ Cover Photo</span>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PlaceDetails;
