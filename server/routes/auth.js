const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const db = require('../config/db');
const verifyUser = require('../middleware/userAuth');

const router = express.Router();

// Email regex pattern for basic format validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


// =====================================================
// TOURIST REGISTRATION
// POST /api/auth/register
// =====================================================

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    // Field presence validation
    if (!name || !email || !password) {
        return res.status(400).json({
            message: 'Name, email, and password are required.'
        });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
        return res.status(400).json({
            message: 'Name must be at least 2 characters long.'
        });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({
            message: 'Please provide a valid email address.'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: 'Password must be at least 6 characters long.'
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        `;

        db.query(sql, [trimmedName, normalizedEmail, hashedPassword], (err, result) => {
            if (err) {
                // Check for MySQL duplicate key error code
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({
                        message: 'An account with this email already exists.'
                    });
                }

                console.error('Registration database error:', err);
                return res.status(500).json({
                    message: 'Registration failed due to a server error.'
                });
            }

            const newUserId = result.insertId;

            // Generate JWT for tourist session
            const token = jwt.sign(
                {
                    user_id: newUserId,
                    name: trimmedName,
                    email: normalizedEmail,
                    role: 'tourist'
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: '7d'
                }
            );

            return res.status(201).json({
                message: 'Registration successful',
                token: token,
                user: {
                    user_id: newUserId,
                    name: trimmedName,
                    email: normalizedEmail
                }
            });
        });
    } catch (error) {
        console.error('Password hashing error:', error);
        return res.status(500).json({
            message: 'Server error while processing registration.'
        });
    }
});


// =====================================================
// TOURIST LOGIN
// POST /api/auth/login
// =====================================================

router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: 'Email and password are required.'
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const sql = `
        SELECT user_id, name, email, password, created_at
        FROM users
        WHERE email = ?
        LIMIT 1
    `;

    db.query(sql, [normalizedEmail], async (err, results) => {
        if (err) {
            console.error('Login database error:', err);
            return res.status(500).json({
                message: 'Server error during login.'
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const user = results[0];

        try {
            const passwordMatches = await bcrypt.compare(password, user.password);

            if (!passwordMatches) {
                return res.status(401).json({
                    message: 'Invalid email or password.'
                });
            }

            // Generate JWT token with tourist role
            const token = jwt.sign(
                {
                    user_id: user.user_id,
                    name: user.name,
                    email: user.email,
                    role: 'tourist'
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: '7d'
                }
            );

            return res.json({
                message: 'Login successful',
                token: token,
                user: {
                    user_id: user.user_id,
                    name: user.name,
                    email: user.email
                }
            });
        } catch (error) {
            console.error('Bcrypt comparison error:', error);
            return res.status(500).json({
                message: 'Server error verifying credentials.'
            });
        }
    });
});


// =====================================================
// CURRENT AUTHENTICATED TOURIST
// GET /api/auth/me
// =====================================================

router.get('/me', verifyUser, (req, res) => {
    const userId = req.user.user_id;

    const sql = `
        SELECT user_id, name, email, created_at
        FROM users
        WHERE user_id = ?
        LIMIT 1
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Fetch /me error:', err);
            return res.status(500).json({
                message: 'Server error retrieving user data.'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        return res.json({
            user: results[0]
        });
    });
});


// =====================================================
// TOURIST LOGOUT (Informational / Session cleanup)
// POST /api/auth/logout
// =====================================================

router.post('/logout', (req, res) => {
    return res.json({
        message: 'Logged out successfully.'
    });
});


module.exports = router;
