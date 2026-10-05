import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ItineraryMap from '../components/ItineraryMap';

import '../App.css';


function ItineraryPage() {

  const [places, setPlaces] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [generated, setGenerated] =
    useState(false);

  const [totalDistance, setTotalDistance] =
    useState(0);

  const [totalTime, setTotalTime] =
    useState(0);


  const PANADURA_LAT = 6.7132;
  const PANADURA_LNG = 79.9025;


  // =====================================================
  // LOAD ITINERARY
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

            const data =
              await response.json();

            loadedPlaces.push(data);

          }

        }


        setPlaces(
          loadedPlaces
        );

      } catch (error) {

        console.error(
          'Error loading itinerary:',
          error
        );

      } finally {

        setLoading(false);

      }

    };


    loadItinerary();

  }, []);


  // =====================================================
  // HAVERSINE DISTANCE
  // =====================================================

  const calculateDistance = (
    lat1,
    lon1,
    lat2,
    lon2
  ) => {

    const R = 6371;


    const toRadians =
      (degree) =>
        degree * (Math.PI / 180);


    const dLat =
      toRadians(
        lat2 - lat1
      );


    const dLon =
      toRadians(
        lon2 - lon1
      );


    const a =

      Math.sin(dLat / 2) *
      Math.sin(dLat / 2)

      +

      Math.cos(
        toRadians(lat1)
      ) *

      Math.cos(
        toRadians(lat2)
      ) *

      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);


    const c =

      2 *

      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );


    return R * c;

  };


  // =====================================================
  // GENERATE OPTIMIZED ITINERARY
  // =====================================================

  const generateItinerary = () => {

    if (places.length === 0) {
      return;
    }


    const validPlaces =
      places.filter(
        (place) =>
          place.latitude !== null &&
          place.longitude !== null
      );


    const invalidPlaces =
      places.filter(
        (place) =>
          place.latitude === null ||
          place.longitude === null
      );


    let remaining =
      [...validPlaces];


    const optimized = [];


    let currentLat =
      PANADURA_LAT;

    let currentLng =
      PANADURA_LNG;


    let distanceTotal = 0;


    while (
      remaining.length > 0
    ) {

      let nearestIndex = 0;

      let nearestDistance =
        Infinity;


      remaining.forEach(
        (place, index) => {

          const distance =
            calculateDistance(
              currentLat,
              currentLng,
              Number(
                place.latitude
              ),
              Number(
                place.longitude
              )
            );


          if (
            distance <
            nearestDistance
          ) {

            nearestDistance =
              distance;

            nearestIndex =
              index;

          }

        }
      );


      const nearestPlace =
        remaining[
          nearestIndex
        ];


      optimized.push(
        nearestPlace
      );


      distanceTotal +=
        nearestDistance;


      currentLat =
        Number(
          nearestPlace.latitude
        );


      currentLng =
        Number(
          nearestPlace.longitude
        );


      remaining.splice(
        nearestIndex,
        1
      );

    }


    const finalOrder = [
      ...optimized,
      ...invalidPlaces
    ];


    setPlaces(
      finalOrder
    );


    setTotalDistance(
      distanceTotal
    );


    // Approximate urban travel
    // speed = 30 km/h

    const estimatedMinutes =
      Math.round(
        (distanceTotal / 30) *
        60
      );


    setTotalTime(
      estimatedMinutes
    );


    setGenerated(true);


    localStorage.setItem(
      'tripPanaItinerary',
      JSON.stringify(
        finalOrder.map(
          (place) =>
            place.place_id
        )
      )
    );

  };


  // =====================================================
  // REMOVE PLACE
  // =====================================================

  const removePlace = (
    placeId
  ) => {

    const updatedPlaces =
      places.filter(
        (place) =>
          place.place_id !==
          placeId
      );


    setPlaces(
      updatedPlaces
    );


    setGenerated(false);

    setTotalDistance(0);

    setTotalTime(0);


    localStorage.setItem(
      'tripPanaItinerary',

      JSON.stringify(
        updatedPlaces.map(
          (place) =>
            place.place_id
        )
      )
    );

  };


  // =====================================================
  // CLEAR ITINERARY
  // =====================================================

  const clearItinerary = () => {

    localStorage.removeItem(
      'tripPanaItinerary'
    );


    setPlaces([]);

    setGenerated(false);

    setTotalDistance(0);

    setTotalTime(0);

  };


  // =====================================================
  // FORMAT TIME
  // =====================================================

  const formatTime = (
    minutes
  ) => {

    const hours =
      Math.floor(
        minutes / 60
      );


    const remainingMinutes =
      minutes % 60;


    if (hours === 0) {

      return `${remainingMinutes} min`;

    }


    return (
      `${hours} hr ` +
      `${remainingMinutes} min`
    );

  };


  return (

    <div className="itinerary-page">


      {/* NAVBAR */}

      <nav className="navbar">

        <div className="logo">

          Trip<span>Pana</span>

        </div>


        <div className="nav-links">

          <Link to="/">
            Home
          </Link>

          <Link to="/">
            Explore
          </Link>

          <Link to="/itinerary">
            Itinerary
          </Link>

          <a href="#">
            Login
          </a>

        </div>

      </nav>


      <div className="itinerary-container">


        {/* PAGE HEADER */}

        <div className="itinerary-heading">

          <div>

            <h1>
              Your One-Day Itinerary
            </h1>

            <p>

              Select attractions and
              let TripPana arrange
              your visit.

            </p>

          </div>


          {places.length > 0 && (

            <button
              className="clear-button"
              onClick={
                clearItinerary
              }
            >

              Clear Itinerary

            </button>

          )}

        </div>


        {loading ? (

          <p className="message">

            Loading itinerary...

          </p>

        ) : places.length === 0 ? (

          <div className="empty-itinerary">

            <h2>
              No places added yet
            </h2>

            <p>

              Explore attractions
              and add places to
              create your trip.

            </p>


            <Link
              to="/"
              className="explore-button"
            >

              Explore Places

            </Link>

          </div>

        ) : (

          <>


            {/* GENERATE BUTTON */}

            <div className="planner-actions">

              <button
                className="generate-button"
                onClick={
                  generateItinerary
                }
              >

                Generate Optimized Itinerary

              </button>

            </div>


            {/* SUMMARY */}

            {generated && (

              <div className="itinerary-summary">


                <div className="summary-box">

                  <span>
                    Selected Places
                  </span>

                  <strong>
                    {places.length}
                  </strong>

                </div>


                <div className="summary-box">

                  <span>
                    Estimated Distance
                  </span>

                  <strong>

                    {
                      totalDistance
                        .toFixed(1)
                    } km

                  </strong>

                </div>


                <div className="summary-box">

                  <span>
                    Estimated Travel Time
                  </span>

                  <strong>

                    {
                      formatTime(
                        totalTime
                      )
                    }

                  </strong>

                </div>


              </div>

            )}


            {/* MAP */}

            <section className="map-section">

              <div className="map-heading">

                <h2>
                  Trip Map
                </h2>

                <p>
                  Your selected attractions
                  around Panadura.
                </p>

              </div>


              <ItineraryMap
                places={places}
              />

            </section>


            {/* PLACE LIST */}

            <div className="itinerary-list">

              {places.map(
                (
                  place,
                  index
                ) => (

                  <div
                    className="itinerary-item"
                    key={
                      place.place_id
                    }
                  >


                    <div className="visit-number">

                      {
                        index + 1
                      }

                    </div>


                    <img
                      src={
                        place.image_url ||

                        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee'
                      }

                      alt={
                        place.title
                      }
                    />


                    <div className="itinerary-item-info">

                      <h3>

                        {
                          place.title
                        }

                      </h3>


                      <p>

                        {
                          place.location
                        }

                      </p>


                      {
                        place.latitude !== null &&
                        place.longitude !== null
                          ? (

                            <span>

                              Map location available

                            </span>

                          )
                          : (

                            <span className="coordinate-warning">

                              Map coordinates unavailable

                            </span>

                          )
                      }

                    </div>


                    <button
                      className="remove-button"

                      onClick={() =>
                        removePlace(
                          place.place_id
                        )
                      }
                    >

                      Remove

                    </button>


                  </div>

                )
              )}

            </div>


          </>

        )}

      </div>

    </div>

  );

}

export default ItineraryPage;