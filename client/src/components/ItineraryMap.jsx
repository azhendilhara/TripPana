import { useEffect } from 'react';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from 'react-leaflet';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';


// =====================================================
// FIX LEAFLET MARKER ICONS FOR VITE
// =====================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});


// =====================================================
// PANADURA STARTING POINT
// =====================================================

const PANADURA_POSITION = [
  6.7132,
  79.9025
];


// =====================================================
// AUTOMATICALLY FIT MAP AROUND PLACES
// =====================================================

function FitMapBounds({ positions }) {

  const map = useMap();

  useEffect(() => {

    if (positions.length > 0) {

      const bounds =
        L.latLngBounds(positions);

      map.fitBounds(bounds, {
        padding: [40, 40]
      });

    }

  }, [positions, map]);

  return null;
}


// =====================================================
// ITINERARY MAP
// =====================================================

function ItineraryMap({ places }) {

  const validPlaces =
    places.filter(
      (place) =>
        place.latitude !== null &&
        place.longitude !== null
    );


  const placePositions =
    validPlaces.map(
      (place) => [
        Number(place.latitude),
        Number(place.longitude)
      ]
    );


  // Start route from Panadura
  const routePositions = [
    PANADURA_POSITION,
    ...placePositions
  ];


  return (

    <div className="itinerary-map-wrapper">

      <MapContainer
        center={PANADURA_POSITION}
        zoom={11}
        className="itinerary-map"
      >

        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        {/* Panadura starting location */}

        <Marker position={PANADURA_POSITION}>

          <Popup>

            <strong>Starting Point</strong>

            <br />

            Panadura

          </Popup>

        </Marker>


        {/* Attraction markers */}

        {validPlaces.map(
          (place, index) => (

            <Marker
              key={place.place_id}
              position={[
                Number(place.latitude),
                Number(place.longitude)
              ]}
            >

              <Popup>

                <strong>
                  Stop {index + 1}
                </strong>

                <br />

                {place.title}

                <br />

                {place.location}

              </Popup>

            </Marker>

          )
        )}


        {/* Route line */}

        {routePositions.length > 1 && (

          <Polyline
            positions={routePositions}
          />

        )}


        <FitMapBounds
          positions={routePositions}
        />

      </MapContainer>

    </div>

  );

}

export default ItineraryMap;