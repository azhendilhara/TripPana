const express = require('express');
const router = express.Router();

const db = require('../config/db');
const verifyAdmin = require('../middleware/auth');


// =====================================================
// GET ALL CATEGORIES
// Public route (used by homepage filters & admin dropdowns)
// GET /api/categories
// =====================================================

router.get('/', (req, res) => {
    const sql = `
        SELECT
            c.category_id,
            c.name,
            c.description,
            COUNT(p.place_id) AS place_count
        FROM categories c
        LEFT JOIN places p ON c.category_id = p.category_id
        GROUP BY c.category_id, c.name, c.description
        ORDER BY c.name ASC;
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching categories:', err);
            return res.status(500).json({
                message: 'Failed to retrieve categories.'
            });
        }

        return res.json(results);
    });
});


// =====================================================
// CREATE NEW CATEGORY
// Admin only (verifyAdmin)
// POST /api/categories
// =====================================================

router.post('/', verifyAdmin, (req, res) => {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
            message: 'Category name is required and must be at least 2 characters long.'
        });
    }

    const trimmedName = name.trim();
    const trimmedDesc = description ? description.trim() : null;

    if (trimmedName.length > 100) {
        return res.status(400).json({
            message: 'Category name must not exceed 100 characters.'
        });
    }

    const sql = `
        INSERT INTO categories (name, description)
        VALUES (?, ?);
    `;

    db.query(sql, [trimmedName, trimmedDesc], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    message: `A category named "${trimmedName}" already exists.`
                });
            }

            console.error('Error inserting category:', err);
            return res.status(500).json({
                message: 'Failed to create category.'
            });
        }

        return res.status(201).json({
            message: 'Category created successfully.',
            category_id: result.insertId,
            name: trimmedName,
            description: trimmedDesc
        });
    });
});


// =====================================================
// UPDATE CATEGORY
// Admin only (verifyAdmin)
// PUT /api/categories/:id
// =====================================================

router.put('/:id', verifyAdmin, (req, res) => {
    const categoryId = Number(req.params.id);
    const { name, description } = req.body;

    if (isNaN(categoryId)) {
        return res.status(400).json({
            message: 'Invalid category ID.'
        });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
            message: 'Category name is required and must be at least 2 characters long.'
        });
    }

    const trimmedName = name.trim();
    const trimmedDesc = description ? description.trim() : null;

    const sql = `
        UPDATE categories
        SET name = ?, description = ?
        WHERE category_id = ?;
    `;

    db.query(sql, [trimmedName, trimmedDesc, categoryId], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    message: `A category named "${trimmedName}" already exists.`
                });
            }

            console.error('Error updating category:', err);
            return res.status(500).json({
                message: 'Failed to update category.'
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Category not found.'
            });
        }

        return res.json({
            message: 'Category updated successfully.',
            category_id: categoryId,
            name: trimmedName,
            description: trimmedDesc
        });
    });
});


// =====================================================
// DELETE CATEGORY SAFELY
// Admin only (verifyAdmin)
// DELETE /api/categories/:id
// Prevents deletion if category is currently used by places
// =====================================================

router.delete('/:id', verifyAdmin, (req, res) => {
    const categoryId = Number(req.params.id);

    if (isNaN(categoryId)) {
        return res.status(400).json({
            message: 'Invalid category ID.'
        });
    }

    // Safety check: is this category assigned to any existing place?
    const checkUsageSql = `
        SELECT COUNT(*) AS place_count
        FROM places
        WHERE category_id = ?;
    `;

    db.query(checkUsageSql, [categoryId], (checkErr, countRows) => {
        if (checkErr) {
            console.error('Error checking category usage:', checkErr);
            return res.status(500).json({
                message: 'Server error checking category usage.'
            });
        }

        const placeCount = countRows[0].place_count;

        if (placeCount > 0) {
            return res.status(400).json({
                message: `Cannot delete category: it is currently assigned to ${placeCount} place(s). Please reassign or delete those places first.`
            });
        }

        const deleteSql = `
            DELETE FROM categories
            WHERE category_id = ?;
        `;

        db.query(deleteSql, [categoryId], (delErr, result) => {
            if (delErr) {
                console.error('Error deleting category:', delErr);
                return res.status(500).json({
                    message: 'Failed to delete category.'
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: 'Category not found.'
                });
            }

            return res.json({
                message: 'Category deleted successfully.',
                category_id: categoryId
            });
        });
    });
});


module.exports = router;
