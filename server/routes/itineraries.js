const express = require('express');
const router = express.Router();

const db = require('../config/db');
const verifyUser = require('../middleware/userAuth');

// All saved itinerary routes require tourist authentication
router.use(verifyUser);


// =====================================================
// SAVE ITINERARY PERMANENTLY IN MYSQL
// POST /api/itineraries
// Body: { title, total_distance, total_time, places }
// =====================================================

router.post('/', (req, res) => {
    const userId = req.user.user_id;
    const { title, total_distance, total_time, places } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
            message: 'A valid itinerary title is required.'
        });
    }

    const trimmedTitle = title.trim();

    if (trimmedTitle.length > 200) {
        return res.status(400).json({
            message: 'Title must not exceed 200 characters.'
        });
    }

    // Validate places array
    if (!places || !Array.isArray(places) || places.length === 0) {
        return res.status(400).json({
            message: 'Itinerary must contain at least one place.'
        });
    }

    // Parse place IDs and check validity
    const parsedPlaces = [];
    for (let i = 0; i < places.length; i++) {
        const item = places[i];
        const placeId = Number(typeof item === 'object' && item !== null ? item.place_id : item);
        const visitOrder =
            typeof item === 'object' && item !== null && item.visit_order
                ? Number(item.visit_order)
                : i + 1;

        if (isNaN(placeId) || placeId <= 0) {
            return res.status(400).json({
                message: `Invalid place ID at position ${i + 1}.`
            });
        }

        parsedPlaces.push({ placeId, visitOrder });
    }

    const numericDistance = Number(total_distance) || 0;
    const numericTime = Number(total_time) || 0;

    // Verify places exist in database
    const placeIds = parsedPlaces.map((p) => p.placeId);
    const verifySql = `SELECT place_id FROM places WHERE place_id IN (?);`;

    db.query(verifySql, [placeIds], (checkErr, validRows) => {
        if (checkErr) {
            console.error('Error verifying places:', checkErr);
            return res.status(500).json({
                message: 'Server error verifying places.'
            });
        }

        if (validRows.length !== placeIds.length) {
            return res.status(400).json({
                message: 'One or more selected places do not exist in the database.'
            });
        }

        // Safe Database Transaction
        db.beginTransaction((txErr) => {
            if (txErr) {
                console.error('Transaction start error:', txErr);
                return res.status(500).json({
                    message: 'Server error starting transaction.'
                });
            }

            const insertItinerarySql = `
                INSERT INTO itineraries (user_id, title, total_distance, total_time)
                VALUES (?, ?, ?, ?);
            `;

            db.query(
                insertItinerarySql,
                [userId, trimmedTitle, numericDistance, numericTime],
                (itErr, itResult) => {
                    if (itErr) {
                        return db.rollback(() => {
                            console.error('Error inserting itinerary header:', itErr);
                            return res.status(500).json({
                                message: 'Failed to create itinerary record.'
                            });
                        });
                    }

                    const newItineraryId = itResult.insertId;

                    // Build bulk insert rows preserving visit_order
                    const placeValues = parsedPlaces.map((p) => [
                        newItineraryId,
                        p.placeId,
                        p.visitOrder
                    ]);

                    const insertPlacesSql = `
                        INSERT INTO itinerary_places (itinerary_id, place_id, visit_order)
                        VALUES ?;
                    `;

                    db.query(insertPlacesSql, [placeValues], (placesErr) => {
                        if (placesErr) {
                            return db.rollback(() => {
                                console.error('Error inserting itinerary places:', placesErr);
                                return res.status(500).json({
                                    message:
                                        'Failed to save itinerary places. Transaction rolled back.'
                                });
                            });
                        }

                        // Commit transaction
                        db.commit((commitErr) => {
                            if (commitErr) {
                                return db.rollback(() => {
                                    console.error('Transaction commit error:', commitErr);
                                    return res.status(500).json({
                                        message: 'Failed to commit transaction.'
                                    });
                                });
                            }

                            return res.status(201).json({
                                message: 'Itinerary saved successfully.',
                                itinerary_id: newItineraryId,
                                title: trimmedTitle,
                                total_distance: numericDistance,
                                total_time: numericTime,
                                place_count: parsedPlaces.length
                            });
                        });
                    });
                }
            );
        });
    });
});


// =====================================================
// LIST LOGGED-IN TOURIST'S SAVED ITINERARIES
// GET /api/itineraries
// =====================================================

router.get('/', (req, res) => {
    const userId = req.user.user_id;

    const sql = `
        SELECT
            i.itinerary_id,
            i.user_id,
            i.title,
            i.total_distance,
            i.total_time,
            i.created_at,
            COUNT(ip.itinerary_place_id) AS place_count
        FROM itineraries i
        LEFT JOIN itinerary_places ip ON i.itinerary_id = ip.itinerary_id
        WHERE i.user_id = ?
        GROUP BY i.itinerary_id
        ORDER BY i.created_at DESC;
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching tourist itineraries:', err);
            return res.status(500).json({
                message: 'Failed to retrieve saved itineraries.'
            });
        }

        return res.json(results);
    });
});


// =====================================================
// GET ONE SAVED ITINERARY WITH ORDERED PLACES
// GET /api/itineraries/:id
// =====================================================

router.get('/:id', (req, res) => {
    const userId = req.user.user_id;
    const itineraryId = Number(req.params.id);

    if (isNaN(itineraryId)) {
        return res.status(400).json({
            message: 'Invalid itinerary ID.'
        });
    }

    // Ensure itinerary belongs to this tourist
    const headerSql = `
        SELECT
            itinerary_id,
            user_id,
            title,
            total_distance,
            total_time,
            created_at
        FROM itineraries
        WHERE itinerary_id = ? AND user_id = ?
        LIMIT 1;
    `;

    db.query(headerSql, [itineraryId, userId], (err, headerRows) => {
        if (err) {
            console.error('Error fetching itinerary header:', err);
            return res.status(500).json({
                message: 'Failed to retrieve itinerary.'
            });
        }

        if (headerRows.length === 0) {
            return res.status(404).json({
                message: 'Itinerary not found or access denied.'
            });
        }

        const itinerary = headerRows[0];

        // Fetch ordered places with details
        const placesSql = `
            SELECT
                ip.itinerary_place_id,
                ip.visit_order,
                p.place_id,
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
            FROM itinerary_places ip
            INNER JOIN places p ON ip.place_id = p.place_id
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE ip.itinerary_id = ?
            ORDER BY ip.visit_order ASC;
        `;

        db.query(placesSql, [itineraryId], (placesErr, placeRows) => {
            if (placesErr) {
                console.error('Error fetching itinerary places:', placesErr);
                return res.status(500).json({
                    message: 'Failed to retrieve itinerary places.'
                });
            }

            return res.json({
                ...itinerary,
                places: placeRows
            });
        });
    });
});


// =====================================================
// DELETE ONE SAVED ITINERARY
// DELETE /api/itineraries/:id
// =====================================================

router.delete('/:id', (req, res) => {
    const userId = req.user.user_id;
    const itineraryId = Number(req.params.id);

    if (isNaN(itineraryId)) {
        return res.status(400).json({
            message: 'Invalid itinerary ID.'
        });
    }

    const deleteSql = `
        DELETE FROM itineraries
        WHERE itinerary_id = ? AND user_id = ?;
    `;

    db.query(deleteSql, [itineraryId, userId], (err, result) => {
        if (err) {
            console.error('Error deleting itinerary:', err);
            return res.status(500).json({
                message: 'Failed to delete itinerary.'
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Itinerary not found or access denied.'
            });
        }

        return res.json({
            message: 'Itinerary and its ordered places deleted successfully.',
            itinerary_id: itineraryId
        });
    });
});


module.exports = router;
