const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = require('../config/db');

const router = express.Router();


// =====================================================
// ADMIN LOGIN
// POST /api/admin/login
// =====================================================

router.post('/login', (req, res) => {

    const {
        username,
        password
    } = req.body;


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


module.exports = router;