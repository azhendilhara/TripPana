const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '../uploads/places');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Configure Multer Disk Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpg';
    const placePrefix = req.params.id ? `place_${req.params.id}_` : 'place_';
    const uniqueName = `${placePrefix}${Date.now()}_${crypto.randomBytes(6).toString('hex')}${cleanExt}`;
    cb(null, uniqueName);
  }
});

// File validation filter
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  }
  
  cb(null, true);
};

// Multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max per image
  }
});

// Middleware wrapper to handle Multer validation and size errors cleanly
const uploadMultipleImages = (req, res, next) => {
  const uploadHandler = upload.array('images', 10); // up to 10 files per request

  uploadHandler(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'File size too large. Maximum size allowed is 5 MB per image.'
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          message: 'Too many files uploaded or unexpected field name. Please use field "images".'
        });
      }
      return res.status(400).json({
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        message: err.message
      });
    }
    next();
  });
};

module.exports = {
  uploadMultipleImages,
  UPLOAD_DIR
};
