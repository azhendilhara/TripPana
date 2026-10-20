const express = require('express');
const router = express.Router();

const db = require('../config/db');
const verifyUser = require('../middleware/userAuth');

// All favorite routes require tourist authentication
router.use(verifyUser);


// =====================================================
// GET LOGGED-IN TOURIST'S FAVOURITES
// GET /api/favorites
// =====================================================

router.get('/', (req, res) => {
    const userId = req.user.user_id;

    const sql = `
        SELECT
            f.favorite_id,
            f.user_id,
            f.place_id,
            f.created_at AS favorited_at,
            p.title,
            p.description,
            p.location,
            p.address,
            p.latitude,
            p.longitude,
            p.opening_hours,
            p.entry_fee,
            p.distance_from_panadura,
            p.image_url,
            c.name AS category
        FROM favorites f
        INNER JOIN places p ON f.place_id = p.place_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC;
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching favorites:', err);
            return res.status(500).json({
                message: 'Failed to retrieve favourites.'
            });
        }

        return res.json(results);
    });
});


// =====================================================
// CHECK IF A SPECIFIC PLACE IS FAVOURITED
// GET /api/favorites/check/:placeId
// =====================================================

router.get('/check/:placeId', (req, res) => {
    const userId = req.user.user_id;
    const placeId = Number(req.params.placeId);

    if (isNaN(placeId)) {
        return res.status(400).json({
            message: 'Invalid place ID.'
        });
    }

    const sql = `
        SELECT favorite_id
        FROM favorites
        WHERE user_id = ? AND place_id = ?
        LIMIT 1;
    `;

    db.query(sql, [userId, placeId], (err, results) => {
        if (err) {
            console.error('Error checking favorite status:', err);
            return res.status(500).json({
                message: 'Failed to check favourite status.'
            });
        }

        const isFavorite = results.length > 0;
        return res.json({
            isFavorite,
            favorite_id: isFavorite ? results[0].favorite_id : null
        });
    });
});


// =====================================================
// ADD A FAVOURITE PLACE
// POST /api/favorites
// =====================================================

router.post('/', (req, res) => {
    const userId = req.user.user_id;
    const placeId = Number(req.body.place_id);

    if (!placeId || isNaN(placeId)) {
        return res.status(400).json({
            message: 'Valid place_id is required.'
        });
    }

    // Verify the place exists in the database
    const checkPlaceSql = `SELECT place_id FROM places WHERE place_id = ? LIMIT 1;`;

    db.query(checkPlaceSql, [placeId], (placeErr, placeResults) => {
        if (placeErr) {
            console.error('Error checking place existence:', placeErr);
            return res.status(500).json({
                message: 'Server error verifying place.'
            });
        }

        if (placeResults.length === 0) {
            return res.status(404).json({
                message: 'Place not found.'
            });
        }

        // Insert into favorites
        const insertSql = `
            INSERT INTO favorites (user_id, place_id)
            VALUES (?, ?);
        `;

        db.query(insertSql, [userId, placeId], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({
                        message: 'Place is already in your favourites.'
                    });
                }

                console.error('Error adding favorite:', err);
                return res.status(500).json({
                    message: 'Failed to add place to favourites.'
                });
            }

            return res.status(201).json({
                message: 'Place added to favourites successfully.',
                favorite_id: result.insertId,
                place_id: placeId
            });
        });
    });
});


// =====================================================
// REMOVE A FAVOURITE PLACE
// DELETE /api/favorites/:placeId
// =====================================================

router.delete('/:placeId', (req, res) => {
    const userId = req.user.user_id;
    const placeId = Number(req.params.placeId);

    if (isNaN(placeId)) {
        return res.status(400).json({
            message: 'Invalid place ID.'
        });
    }

    const sql = `
        DELETE FROM favorites
        WHERE user_id = ? AND place_id = ?;
    `;

    db.query(sql, [userId, placeId], (err, result) => {
        if (err) {
            console.error('Error removing favorite:', err);
            return res.status(500).json({
                message: 'Failed to remove favourite.'
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Place is not in your favourites.'
            });
        }

        return res.json({
            message: 'Place removed from favourites successfully.',
            place_id: placeId
        });
    });
});


module.exports = router;
