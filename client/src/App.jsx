import {
  BrowserRouter,
  Routes,
  Route
} from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import PlaceDetails from './pages/PlaceDetails';
import ItineraryPage from './pages/ItineraryPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FavoritesPage from './pages/FavoritesPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminReviewsPage from './pages/AdminReviewsPage';
import SavedItinerariesPage from './pages/SavedItinerariesPage';
import SavedItineraryDetailPage from './pages/SavedItineraryDetailPage';

function App() {
  return (
    <AuthProvider>
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

          <Route
            path="/my-itineraries"
            element={<SavedItinerariesPage />}
          />

          <Route
            path="/my-itineraries/:id"
            element={<SavedItineraryDetailPage />}
          />

          <Route
            path="/favorites"
            element={<FavoritesPage />}
          />

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/register"
            element={<RegisterPage />}
          />

          <Route
            path="/admin/login"
            element={<AdminLoginPage />}
          />

          <Route
            path="/admin"
            element={<AdminDashboardPage />}
          />

          <Route
            path="/admin/dashboard"
            element={<AdminDashboardPage />}
          />

          <Route
            path="/admin/reviews"
            element={<AdminDashboardPage initialTab="reviews" />}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
