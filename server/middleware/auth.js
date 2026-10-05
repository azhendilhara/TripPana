const jwt = require('jsonwebtoken');

function verifyAdmin(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: 'Access denied. No token provided.'
        });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            message: 'Access denied. Invalid token format.'
        });
    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.role !== 'admin') {
            return res.status(403).json({
                message: 'Admin access required.'
            });
        }

        req.admin = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message: 'Invalid or expired token.'
        });

    }
}

module.exports = verifyAdmin;