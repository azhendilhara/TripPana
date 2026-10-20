import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import resolveImageUrl, { PLACEHOLDER_IMAGE } from '../utils/imageUrl';
import '../App.css';

function HomePage() {
  const [places, setPlaces] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPlaces = async (selectedCategory = category) => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (search) {
        params.append('search', search);
      }

      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      const url =
        params.toString().length > 0
          ? `http://localhost:5000/api/places?${params.toString()}`
          : 'http://localhost:5000/api/places';

      const response = await fetch(url);
      const data = await response.json();

      setPlaces(data);
    } catch (error) {
      console.error('Error loading places:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaces('');

    // Fetch dynamic categories from the database
    const fetchCategories = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.map((c) => c.name));
        }
      } catch (err) {
        console.error('Error loading dynamic categories:', err);
      }
    };

    fetchCategories();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPlaces();
  };

  const handleCategory = (selectedCategory) => {
    setCategory(selectedCategory);
    fetchPlaces(selectedCategory);
  };

  return (
    <div className="app">

      <Navbar />

      <section className="hero">
        <div className="hero-overlay">
          <div className="hero-content">

            <h1>
              Discover Panadura
              <br />
              and Surroundings
            </h1>

            <p>
              Find attractions, explore local places and plan your perfect
              one-day trip.
            </p>

            <form className="search-box" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search attractions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button type="submit">
                Search
              </button>
            </form>

          </div>
        </div>
      </section>

      <main className="main-content">

        <section className="categories-section">
          <h2>Explore by Category</h2>

          <div className="category-buttons">

            <button
              className={category === '' ? 'active' : ''}
              onClick={() => handleCategory('')}
            >
              All
            </button>

            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? 'active' : ''}
                onClick={() => handleCategory(item)}
              >
                {item}
              </button>
            ))}

          </div>
        </section>

        <section className="places-section" id="places">

          <div className="section-heading">
            <div>
              <h2>Places to Visit</h2>
              <p>Discover attractions within the Panadura area.</p>
            </div>

            <span className="place-count">
              {places.length} places
            </span>
          </div>

          {loading ? (

            <p className="message">
              Loading places...
            </p>

          ) : places.length === 0 ? (

            <p className="message">
              No places found.
            </p>

          ) : (

            <div className="places-grid">

              {places.map((place) => (

                <article
                  className="place-card"
                  key={place.place_id}
                >

                  <div className="image-container">

                    <img
                      src={resolveImageUrl(place.primary_image || place.image_url)}
                      alt={place.title}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = PLACEHOLDER_IMAGE;
                      }}
                    />

                    <span className="category-badge">
                      {place.category}
                    </span>

                  </div>

                  <div className="place-content">

                    <h3>{place.title}</h3>

                    <p className="location">
                      {place.location}
                    </p>

                    <p className="description">
                      {place.description}
                    </p>

                    <div className="place-info">

                      <span>
                        {place.distance_from_panadura !== null
                          ? `${place.distance_from_panadura} km`
                          : 'Distance unavailable'}
                      </span>

                      <span>
                        {place.entry_fee || 'Fee unavailable'}
                      </span>

                    </div>

                    <Link
                      to={`/places/${place.place_id}`}
                      className="details-button-link"
                    >
                      View Details
                    </Link>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

      </main>

      <footer>
        <div className="footer-logo">
          TripPana
        </div>

        <p>
          Discover local attractions and plan your perfect day around Panadura.
        </p>

        <p className="copyright">
          © 2026 TripPana
        </p>
      </footer>

    </div>
  );
}

export default HomePage;
