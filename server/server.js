const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');

const app = express();


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());


// =====================================================
// ROUTES
// =====================================================

const placesRoutes = require('./routes/places');
const adminRoutes = require('./routes/admin');

app.use('/api/places', placesRoutes);
app.use('/api/admin', adminRoutes);


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