const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { UPLOAD_DIR } = require('../middleware/upload');

// Helper to format full image URL
const getFullImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return `http://localhost:5000${imagePath}`;
};

// GET /api/places/:id/images
const getPlaceImages = (req, res) => {
  const placeId = Number(req.params.id);

  if (isNaN(placeId)) {
    return res.status(400).json({ message: 'Invalid place ID' });
  }

  const sql = `
    SELECT image_id, place_id, image_path, is_primary, display_order, created_at
    FROM place_images
    WHERE place_id = ?
    ORDER BY is_primary DESC, display_order ASC, image_id ASC;
  `;

  db.query(sql, [placeId], (err, rows) => {
    if (err) {
      console.error('Error fetching place images:', err);
      return res.status(500).json({ message: 'Failed to retrieve place images' });
    }

    const images = rows.map((img) => ({
      ...img,
      is_primary: Boolean(img.is_primary),
      full_url: getFullImageUrl(img.image_path)
    }));

    return res.json(images);
  });
};

// POST /api/places/:id/images or /api/admin/places/:id/images
const uploadPlaceImages = (req, res) => {
  const placeId = Number(req.params.id);

  if (isNaN(placeId)) {
    return res.status(400).json({ message: 'Invalid place ID' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No image files uploaded. Please attach at least one image.' });
  }

  // Verify place exists
  db.query('SELECT place_id FROM places WHERE place_id = ?', [placeId], (placeErr, placeRows) => {
    if (placeErr) {
      console.error('Error verifying place existence:', placeErr);
      return res.status(500).json({ message: 'Database error' });
    }

    if (placeRows.length === 0) {
      // Clean up files on disk
      req.files.forEach((f) => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
      return res.status(404).json({ message: 'Place not found' });
    }

    // Check existing images to determine primary flag and display_order
    const checkSql = `
      SELECT COUNT(*) AS total_images, COALESCE(SUM(is_primary), 0) AS primary_count, COALESCE(MAX(display_order), 0) AS max_order
      FROM place_images
      WHERE place_id = ?;
    `;

    db.query(checkSql, [placeId], (countErr, countRows) => {
      if (countErr) {
        console.error('Error checking images count:', countErr);
        return res.status(500).json({ message: 'Database error' });
      }

      const totalImages = countRows[0].total_images;
      const primaryCount = countRows[0].primary_count;
      const nextOrder = countRows[0].max_order + 1;
      const shouldSetFirstPrimary = totalImages === 0 || primaryCount === 0;

      const insertValues = [];
      const insertedMeta = [];

      req.files.forEach((file, index) => {
        const isPrimary = (shouldSetFirstPrimary && index === 0) ? 1 : 0;
        const relativePath = `/uploads/places/${file.filename}`;
        const order = nextOrder + index;
        insertValues.push([placeId, relativePath, isPrimary, order]);
        insertedMeta.push({
          place_id: placeId,
          image_path: relativePath,
          full_url: getFullImageUrl(relativePath),
          is_primary: Boolean(isPrimary),
          display_order: order,
          filename: file.filename
        });
      });

      const insertSql = `
        INSERT INTO place_images (place_id, image_path, is_primary, display_order)
        VALUES ?;
      `;

      db.query(insertSql, [insertValues], (insertErr, result) => {
        if (insertErr) {
          console.error('Error saving image records:', insertErr);
          return res.status(500).json({ message: 'Failed to record images in database' });
        }

        return res.status(201).json({
          message: `${req.files.length} image(s) uploaded successfully`,
          count: req.files.length,
          inserted_id_start: result.insertId,
          images: insertedMeta
        });
      });
    });
  });
};

// PUT /api/places/:id/images/:imageId/primary or /api/admin/places/:id/images/:imageId/primary
const setPrimaryImage = (req, res) => {
  const placeId = Number(req.params.id);
  const imageId = Number(req.params.imageId);

  if (isNaN(placeId) || isNaN(imageId)) {
    return res.status(400).json({ message: 'Invalid place ID or image ID' });
  }

  // Verify image belongs to this place
  db.query('SELECT image_id FROM place_images WHERE image_id = ? AND place_id = ?', [imageId, placeId], (checkErr, checkRows) => {
    if (checkErr) {
      console.error('Error checking image:', checkErr);
      return res.status(500).json({ message: 'Database error' });
    }

    if (checkRows.length === 0) {
      return res.status(404).json({ message: 'Image not found for this place' });
    }

    // Unset primary for all images of this place
    const unsetSql = 'UPDATE place_images SET is_primary = 0 WHERE place_id = ?';
    db.query(unsetSql, [placeId], (unsetErr) => {
      if (unsetErr) {
        console.error('Error resetting primary images:', unsetErr);
        return res.status(500).json({ message: 'Failed to update primary image' });
      }

      // Set this image as primary
      const setSql = 'UPDATE place_images SET is_primary = 1 WHERE image_id = ? AND place_id = ?';
      db.query(setSql, [imageId, placeId], (setErr) => {
        if (setErr) {
          console.error('Error setting primary image:', setErr);
          return res.status(500).json({ message: 'Failed to set primary image' });
        }

        return res.json({
          message: 'Primary image updated successfully',
          image_id: imageId,
          place_id: placeId
        });
      });
    });
  });
};

// DELETE /api/places/:id/images/:imageId or /api/admin/places/:id/images/:imageId
const deletePlaceImage = (req, res) => {
  const placeId = Number(req.params.id);
  const imageId = Number(req.params.imageId);

  if (isNaN(placeId) || isNaN(imageId)) {
    return res.status(400).json({ message: 'Invalid place ID or image ID' });
  }

  const findSql = 'SELECT image_id, place_id, image_path, is_primary FROM place_images WHERE image_id = ? AND place_id = ?';
  db.query(findSql, [imageId, placeId], (findErr, rows) => {
    if (findErr) {
      console.error('Error finding image to delete:', findErr);
      return res.status(500).json({ message: 'Database error' });
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Image not found' });
    }

    const imageRecord = rows[0];
    const wasPrimary = Boolean(imageRecord.is_primary);

    db.query('DELETE FROM place_images WHERE image_id = ?', [imageId], (delErr) => {
      if (delErr) {
        console.error('Error deleting image from DB:', delErr);
        return res.status(500).json({ message: 'Failed to delete image' });
      }

      // Clean up file on disk
      try {
        const filename = path.basename(imageRecord.image_path);
        const filePath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.warn('Warning: could not delete file from disk:', fileErr.message);
      }

      // If the deleted image was primary, promote next available image
      if (wasPrimary) {
        const nextImgSql = `
          SELECT image_id
          FROM place_images
          WHERE place_id = ?
          ORDER BY display_order ASC, image_id ASC
          LIMIT 1;
        `;

        db.query(nextImgSql, [placeId], (nextErr, nextRows) => {
          let newPrimaryId = null;
          if (!nextErr && nextRows.length > 0) {
            newPrimaryId = nextRows[0].image_id;
            db.query('UPDATE place_images SET is_primary = 1 WHERE image_id = ?', [newPrimaryId]);
          }

          return res.json({
            message: 'Image deleted successfully',
            image_id: imageId,
            was_primary: wasPrimary,
            new_primary_id: newPrimaryId
          });
        });
      } else {
        return res.json({
          message: 'Image deleted successfully',
          image_id: imageId,
          was_primary: false
        });
      }
    });
  });
};

module.exports = {
  getFullImageUrl,
  getPlaceImages,
  uploadPlaceImages,
  setPrimaryImage,
  deletePlaceImage
};
