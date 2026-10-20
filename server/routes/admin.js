const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = require('../config/db');
const verifyAdmin = require('../middleware/auth');

const router = express.Router();


// =====================================================
// ADMIN LOGIN
// POST /api/admin/login
// =====================================================

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: 'Username and password are required.'
        });
    }

    const sql = `
        SELECT *
        FROM admins
        WHERE username = ?
        LIMIT 1
    `;

    db.query(sql, [username], async (err, results) => {
        if (err) {
            console.error('Admin login error:', err);
            return res.status(500).json({
                message: 'Server error'
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                message: 'Invalid username or password.'
            });
        }

        const admin = results[0];

        try {
            const passwordMatches = await bcrypt.compare(
                password,
                admin.password
            );

            if (!passwordMatches) {
                return res.status(401).json({
                    message: 'Invalid username or password.'
                });
            }

            const token = jwt.sign(
                {
                    admin_id: admin.admin_id,
                    username: admin.username,
                    role: 'admin'
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: '2h'
                }
            );

            res.json({
                message: 'Admin login successful',
                token: token,
                admin: {
                    admin_id: admin.admin_id,
                    username: admin.username
                }
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: 'Login failed'
            });
        }
    });
});


// =====================================================
// GET ADMIN DASHBOARD OVERVIEW METRICS
// Admin only (verifyAdmin)
// GET /api/admin/stats
// =====================================================

router.get('/stats', verifyAdmin, (req, res) => {
    const sql = `
        SELECT
            (SELECT COUNT(*) FROM places) AS total_places,
            (SELECT COUNT(*) FROM categories) AS total_categories,
            (SELECT COUNT(*) FROM users) AS total_users,
            (SELECT COUNT(*) FROM itineraries) AS total_itineraries,
            (SELECT COUNT(*) FROM reviews WHERE status = 'pending') AS pending_reviews,
            (SELECT COUNT(*) FROM reviews WHERE status = 'approved') AS approved_reviews;
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching admin statistics:', err);
            return res.status(500).json({
                message: 'Failed to retrieve dashboard statistics.'
            });
        }

        const row = results[0];
        return res.json({
            total_places: row.total_places || 0,
            total_categories: row.total_categories || 0,
            total_users: row.total_users || 0,
            total_itineraries: row.total_itineraries || 0,
            pending_reviews: row.pending_reviews || 0,
            approved_reviews: row.approved_reviews || 0
        });
    });
});


// =====================================================
// GET REVIEWS FOR ADMIN MODERATION
// Admin only (verifyAdmin)
// GET /api/admin/reviews
// Optional query: ?status=pending|approved|rejected|all
// =====================================================

router.get('/reviews', verifyAdmin, (req, res) => {
    const filterStatus = req.query.status || 'pending';

    let sql = `
        SELECT
            r.review_id,
            r.user_id,
            u.name AS user_name,
            u.email AS user_email,
            r.place_id,
            COALESCE(p.title, 'Deleted Place') AS place_title,
            r.rating,
            r.comment,
            r.status,
            r.created_at
        FROM reviews r
        LEFT JOIN users u ON r.user_id = u.user_id
        LEFT JOIN places p ON r.place_id = p.place_id
    `;

    const values = [];

    if (filterStatus && filterStatus !== 'all') {
        sql += ` WHERE r.status = ? `;
        values.push(filterStatus);
    }

    sql += ` ORDER BY r.created_at DESC;`;

    db.query(sql, values, (err, results) => {
        if (err) {
            console.error('Error fetching admin reviews:', err);
            return res.status(500).json({
                message: 'Failed to retrieve reviews for moderation.'
            });
        }

        return res.json(results);
    });
});


// =====================================================
// UPDATE REVIEW MODERATION STATUS
// Admin only (verifyAdmin)
// PUT /api/admin/reviews/:id/status
// Body: { status: 'approved' | 'rejected' }
// =====================================================

router.put('/reviews/:id/status', verifyAdmin, (req, res) => {
    const reviewId = Number(req.params.id);
    const { status } = req.body;

    if (isNaN(reviewId)) {
        return res.status(400).json({
            message: 'Invalid review ID.'
        });
    }

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({
            message: "Status must be 'approved', 'rejected', or 'pending'."
        });
    }

    const sql = `
        UPDATE reviews
        SET status = ?
        WHERE review_id = ?;
    `;

    db.query(sql, [status, reviewId], (err, result) => {
        if (err) {
            console.error('Error updating review status:', err);
            return res.status(500).json({
                message: 'Failed to update review status.'
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Review not found.'
            });
        }

        return res.json({
            message: `Review marked as ${status} successfully.`,
            review_id: reviewId,
            status
        });
    });
});


// =====================================================
// DELETE REVIEW
// Admin only (verifyAdmin)
// DELETE /api/admin/reviews/:id
// =====================================================

router.delete('/reviews/:id', verifyAdmin, (req, res) => {
    const reviewId = Number(req.params.id);

    if (isNaN(reviewId)) {
        return res.status(400).json({
            message: 'Invalid review ID.'
        });
    }

    const sql = `
        DELETE FROM reviews
        WHERE review_id = ?;
    `;

    db.query(sql, [reviewId], (err, result) => {
        if (err) {
            console.error('Error deleting review:', err);
            return res.status(500).json({
                message: 'Failed to delete review.'
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Review not found.'
            });
        }

        return res.json({
            message: 'Review deleted successfully.',
            review_id: reviewId
        });
    });
});


// =====================================================
// PLACE IMAGES MANAGEMENT (Admin Routes)
// =====================================================

const { uploadMultipleImages } = require('../middleware/upload');
const {
    uploadPlaceImages,
    setPrimaryImage,
    deletePlaceImage
} = require('../controllers/placeImagesController');

// POST /api/admin/places/:id/images
router.post('/places/:id/images', verifyAdmin, uploadMultipleImages, uploadPlaceImages);

// PUT /api/admin/places/:id/images/:imageId/primary
router.put('/places/:id/images/:imageId/primary', verifyAdmin, setPrimaryImage);

// DELETE /api/admin/places/:id/images/:imageId
router.delete('/places/:id/images/:imageId', verifyAdmin, deletePlaceImage);


module.exports = router;
