const jwt = require('jsonwebtoken');

function verifyUser(req, res, next) {
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

        // Keep tourist authentication logically separate from admin
        if (decoded.role !== 'tourist') {
            return res.status(403).json({
                message: 'Access denied. Tourist authorization required.'
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired token.'
        });
    }
}

module.exports = verifyUser;
