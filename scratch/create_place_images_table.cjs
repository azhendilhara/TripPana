const db = require('../server/config/db');

const sql = `
  CREATE TABLE IF NOT EXISTS place_images (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    place_id INT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    is_primary TINYINT(1) DEFAULT 0,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_place_id (place_id),
    INDEX idx_is_primary (is_primary),
    CONSTRAINT fk_place_images_places
      FOREIGN KEY (place_id)
      REFERENCES places(place_id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

db.query(sql, (err, res) => {
  if (err) {
    console.error('Error creating place_images table:', err);
    process.exit(1);
  }
  console.log('place_images table created or already exists.');
  db.query('DESCRIBE place_images', (err2, cols) => {
    if (err2) {
      console.error(err2);
      process.exit(1);
    }
    console.table(cols);
    process.exit(0);
  });
});
