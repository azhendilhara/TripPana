const express = require('express');
const router = express.Router();

const db = require('../config/db');
const verifyUser = require('../middleware/userAuth');


// =====================================================
// GET APPROVED REVIEWS FOR A PLACE
// Public endpoint
// GET /api/reviews/place/:placeId
// =====================================================

router.get('/place/:placeId', (req, res) => {
    const placeId = Number(req.params.placeId);

    if (isNaN(placeId)) {
        return res.status(400).json({
            message: 'Invalid place ID.'
        });
    }

    const reviewsSql = `
        SELECT
            r.review_id,
            r.place_id,
            r.rating,
            r.comment,
            r.created_at,
            u.user_id,
            u.name AS user_name
        FROM reviews r
        INNER JOIN users u ON r.user_id = u.user_id
        WHERE r.place_id = ? AND r.status = 'approved'
        ORDER BY r.created_at DESC;
    `;

    const statsSql = `
        SELECT
            COUNT(*) AS total_reviews,
            COALESCE(AVG(rating), 0) AS average_rating
        FROM reviews
        WHERE place_id = ? AND status = 'approved';
    `;

    db.query(reviewsSql, [placeId], (err, reviews) => {
        if (err) {
            console.error('Error fetching approved reviews:', err);
            return res.status(500).json({
                message: 'Failed to retrieve reviews.'
            });
        }

        db.query(statsSql, [placeId], (statsErr, statsResult) => {
            if (statsErr) {
                console.error('Error calculating review stats:', statsErr);
                return res.status(500).json({
                    message: 'Failed to retrieve review statistics.'
                });
            }

            const totalReviews = statsResult[0].total_reviews;
            const averageRating = Number(Number(statsResult[0].average_rating).toFixed(1));

            return res.json({
                stats: {
                    totalReviews,
                    averageRating
                },
                reviews
            });
        });
    });
});


// =====================================================
// SUBMIT A NEW REVIEW
// Tourist only (verifyUser)
// POST /api/reviews
// =====================================================

router.post('/', verifyUser, (req, res) => {
    const userId = req.user.user_id;
    const { place_id, rating, comment } = req.body;

    const numericPlaceId = Number(place_id);
    const numericRating = Number(rating);

    // Validate place ID
    if (!numericPlaceId || isNaN(numericPlaceId)) {
        return res.status(400).json({
            message: 'Valid place_id is required.'
        });
    }

    // Validate rating (must be integer 1 to 5)
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({
            message: 'Rating must be an integer between 1 and 5.'
        });
    }

    // Validate comment
    if (!comment || typeof comment !== 'string' || comment.trim().length < 3) {
        return res.status(400).json({
            message: 'Comment must be at least 3 characters long.'
        });
    }

    if (comment.trim().length > 1500) {
        return res.status(400).json({
            message: 'Comment must not exceed 1500 characters.'
        });
    }

    const trimmedComment = comment.trim();

    // Verify place exists
    const checkPlaceSql = `SELECT place_id FROM places WHERE place_id = ? LIMIT 1;`;

    db.query(checkPlaceSql, [numericPlaceId], (placeErr, placeResults) => {
        if (placeErr) {
            console.error('Error checking place for review:', placeErr);
            return res.status(500).json({
                message: 'Server error checking place existence.'
            });
        }

        if (placeResults.length === 0) {
            return res.status(404).json({
                message: 'Place not found.'
            });
        }

        // Insert review strictly with status 'pending'
        const insertSql = `
            INSERT INTO reviews (user_id, place_id, rating, comment, status)
            VALUES (?, ?, ?, ?, 'pending');
        `;

        db.query(insertSql, [userId, numericPlaceId, numericRating, trimmedComment], (insertErr, result) => {
            if (insertErr) {
                console.error('Error inserting review:', insertErr);
                return res.status(500).json({
                    message: 'Failed to submit review.'
                });
            }

            return res.status(201).json({
                message: 'Your review has been submitted and is awaiting administrator approval.',
                review_id: result.insertId,
                status: 'pending'
            });
        });
    });
});


module.exports = router;
