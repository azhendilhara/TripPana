const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');

const app = express();


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// =====================================================
// ROUTES
// =====================================================

const placesRoutes = require('./routes/places');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const favoritesRoutes = require('./routes/favorites');
const reviewsRoutes = require('./routes/reviews');
const itinerariesRoutes = require('./routes/itineraries');
const categoriesRoutes = require('./routes/categories');

app.use('/api/places', placesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/itineraries', itinerariesRoutes);
app.use('/api/categories', categoriesRoutes);


// =====================================================
// HOME TEST ROUTE
// =====================================================

app.get('/', (req, res) => {

    res.send('TripPana API is running!');

});


// =====================================================
// START SERVER
// =====================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(`TripPana server running on port ${PORT}`);

});
