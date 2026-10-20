const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const db = require('../config/db');
const verifyAdmin = require('../middleware/auth');
const { uploadMultipleImages } = require('../middleware/upload');
const {
    getFullImageUrl,
    getPlaceImages,
    uploadPlaceImages,
    setPrimaryImage,
    deletePlaceImage
} = require('../controllers/placeImagesController');


// =====================================================
// GET ALL PLACES + SEARCH + CATEGORY FILTER
// Public route
// =====================================================

router.get('/', (req, res) => {

    const search = req.query.search || '';
    const category = req.query.category || '';

    let sql = `
        SELECT
            p.place_id,
            p.category_id,
            p.title,
            p.description,
            p.location,
            p.address,
            p.latitude,
            p.longitude,
            p.opening_hours,
            p.entry_fee,
            p.distance_from_panadura,
            p.travel_tips,
            p.image_url,
            c.name AS category,
            (
                SELECT pi.image_path
                FROM place_images pi
                WHERE pi.place_id = p.place_id
                ORDER BY pi.is_primary DESC, pi.display_order ASC, pi.image_id ASC
                LIMIT 1
            ) AS uploaded_primary_image
        FROM places p
        LEFT JOIN categories c
            ON p.category_id = c.category_id
        WHERE 1 = 1
    `;

    const values = [];

    if (search) {

        sql += `
            AND (
                p.title LIKE ?
                OR p.description LIKE ?
                OR p.location LIKE ?
            )
        `;

        const searchValue = `%${search}%`;

        values.push(
            searchValue,
            searchValue,
            searchValue
        );
    }

    if (category) {
        sql += ` AND c.name = ? `;
        values.push(category);
    }

    sql += ` ORDER BY p.place_id; `;

    db.query(sql, values, (err, results) => {

        if (err) {

            console.error('Error fetching places:', err);

            return res.status(500).json({
                message: 'Failed to retrieve places'
            });
        }

        const formatted = results.map((place) => {
            const primaryImg = place.uploaded_primary_image
                ? getFullImageUrl(place.uploaded_primary_image)
                : place.image_url;

            return {
                ...place,
                primary_image: primaryImg,
                image_url: primaryImg // backward compatibility fallback
            };
        });

        res.json(formatted);

    });

});


// =====================================================
// GET ONE PLACE BY ID (WITH FULL IMAGES GALLERY)
// Public route
// =====================================================

router.get('/:id', (req, res) => {

    const placeId = Number(req.params.id);

    if (isNaN(placeId)) {

        return res.status(400).json({
            message: 'Invalid place ID'
        });
    }

    const sql = `
        SELECT
            p.place_id,
            p.category_id,
            p.title,
            p.description,
            p.location,
            p.address,
            p.latitude,
            p.longitude,
            p.opening_hours,
            p.entry_fee,
            p.distance_from_panadura,
            p.travel_tips,
            p.image_url,
            c.name AS category
        FROM places p
        LEFT JOIN categories c
            ON p.category_id = c.category_id
        WHERE p.place_id = ?;
    `;

    db.query(sql, [placeId], (err, results) => {

        if (err) {

            console.error('Error fetching place:', err);

            return res.status(500).json({
                message: 'Failed to retrieve place'
            });
        }

        if (results.length === 0) {

            return res.status(404).json({
                message: 'Place not found'
            });
        }

        const place = results[0];

        // Fetch all uploaded gallery images for this place
        const imagesSql = `
            SELECT image_id, place_id, image_path, is_primary, display_order, created_at
            FROM place_images
            WHERE place_id = ?
            ORDER BY is_primary DESC, display_order ASC, image_id ASC;
        `;

        db.query(imagesSql, [placeId], (imgErr, imgRows) => {
            if (imgErr) {
                console.error('Error fetching place images:', imgErr);
            }

            const images = (imgRows || []).map((img) => ({
                ...img,
                is_primary: Boolean(img.is_primary),
                full_url: getFullImageUrl(img.image_path)
            }));

            const primaryUploaded = images.find((i) => i.is_primary)?.full_url || images[0]?.full_url;
            const activeImage = primaryUploaded || place.image_url;

            res.json({
                ...place,
                primary_image: activeImage,
                image_url: activeImage,
                images: images
            });
        });

    });

});


// =====================================================
// GET APPROVED REVIEWS FOR PLACE
// Public route
// GET /api/places/:id/reviews
// =====================================================

router.get('/:id/reviews', (req, res) => {

    const placeId = Number(req.params.id);

    if (isNaN(placeId)) {
        return res.status(400).json({
            message: 'Invalid place ID'
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
                message: 'Failed to retrieve reviews'
            });
        }

        db.query(statsSql, [placeId], (statsErr, statsResult) => {
            if (statsErr) {
                console.error('Error calculating review stats:', statsErr);
                return res.status(500).json({
                    message: 'Failed to retrieve review statistics'
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
// ADD NEW PLACE
// Admin only
// =====================================================

router.post('/', verifyAdmin, (req, res) => {

    const {
        category_id,
        title,
        description,
        location,
        address,
        latitude,
        longitude,
        opening_hours,
        entry_fee,
        distance_from_panadura,
        travel_tips,
        image_url
    } = req.body;


    if (!title) {

        return res.status(400).json({
            message: 'Place title is required'
        });
    }


    const sql = `
        INSERT INTO places (
            category_id,
            title,
            description,
            location,
            address,
            latitude,
            longitude,
            opening_hours,
            entry_fee,
            distance_from_panadura,
            travel_tips,
            image_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;


    const values = [
        category_id || null,
        title,
        description || null,
        location || null,
        address || null,
        latitude || null,
        longitude || null,
        opening_hours || null,
        entry_fee || null,
        distance_from_panadura || null,
        travel_tips || null,
        image_url || null
    ];


    db.query(sql, values, (err, result) => {

        if (err) {

            console.error('Error adding place:', err);

            return res.status(500).json({
                message: 'Failed to add place'
            });
        }

        res.status(201).json({
            message: 'Place added successfully',
            place_id: result.insertId
        });

    });

});


// =====================================================
// UPDATE PLACE
// Admin only
// =====================================================

router.put('/:id', verifyAdmin, (req, res) => {

    const placeId = req.params.id;

    if (isNaN(placeId)) {

        return res.status(400).json({
            message: 'Invalid place ID'
        });
    }


    const {
        category_id,
        title,
        description,
        location,
        address,
        latitude,
        longitude,
        opening_hours,
        entry_fee,
        distance_from_panadura,
        travel_tips,
        image_url
    } = req.body;


    if (!title) {

        return res.status(400).json({
            message: 'Place title is required'
        });
    }


    const sql = `
        UPDATE places
        SET
            category_id = ?,
            title = ?,
            description = ?,
            location = ?,
            address = ?,
            latitude = ?,
            longitude = ?,
            opening_hours = ?,
            entry_fee = ?,
            distance_from_panadura = ?,
            travel_tips = ?,
            image_url = ?
        WHERE place_id = ?;
    `;


    const values = [
        category_id || null,
        title,
        description || null,
        location || null,
        address || null,
        latitude || null,
        longitude || null,
        opening_hours || null,
        entry_fee || null,
        distance_from_panadura || null,
        travel_tips || null,
        image_url || null,
        placeId
    ];


    db.query(sql, values, (err, result) => {

        if (err) {

            console.error('Error updating place:', err);

            return res.status(500).json({
                message: 'Failed to update place'
            });
        }


        if (result.affectedRows === 0) {

            return res.status(404).json({
                message: 'Place not found'
            });
        }


        res.json({
            message: 'Place updated successfully'
        });

    });

});


// =====================================================
// DELETE PLACE
// Admin only
// =====================================================

router.delete('/:id', verifyAdmin, (req, res) => {

    const placeId = req.params.id;

    if (isNaN(placeId)) {

        return res.status(400).json({
            message: 'Invalid place ID'
        });
    }


    const sql = `
        DELETE FROM places
        WHERE place_id = ?;
    `;


    db.query(sql, [placeId], (err, result) => {

        if (err) {

            console.error('Error deleting place:', err);

            return res.status(500).json({
                message: 'Failed to delete place'
            });
        }


        if (result.affectedRows === 0) {

            return res.status(404).json({
                message: 'Place not found'
            });
        }


        res.json({
            message: 'Place deleted successfully'
        });

    });

});


// =====================================================
// PLACE IMAGES MANAGEMENT
// =====================================================

// GET /api/places/:id/images (Public)
router.get('/:id/images', getPlaceImages);

// POST /api/places/:id/images (Admin only)
router.post('/:id/images', verifyAdmin, uploadMultipleImages, uploadPlaceImages);

// PUT /api/places/:id/images/:imageId/primary (Admin only)
router.put('/:id/images/:imageId/primary', verifyAdmin, setPrimaryImage);

// DELETE /api/places/:id/images/:imageId (Admin only)
router.delete('/:id/images/:imageId', verifyAdmin, deletePlaceImage);


module.exports = router;