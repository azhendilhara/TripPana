import {
  BrowserRouter,
  Routes,
  Route
} from 'react-router-dom';

import HomePage from './pages/HomePage';
import PlaceDetails from './pages/PlaceDetails';
import ItineraryPage from './pages/ItineraryPage';

function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<HomePage />}
        />

        <Route
          path="/places/:id"
          element={<PlaceDetails />}
        />

        <Route
          path="/itinerary"
          element={<ItineraryPage />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;