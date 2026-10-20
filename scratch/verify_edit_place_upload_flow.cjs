const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });
const db = require('../server/config/db');

// Two distinct test JPEG buffers (different byte lengths and payloads)
function createJpegBufferA() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x80, 0xff, 0xd9
  ]);
}

function createJpegBufferB() {
  const base = createJpegBufferA();
  // Append 32 padding bytes to differentiate file size and content
  const padding = Buffer.alloc(32, 0xaa);
  return Buffer.concat([base, padding]);
}

function makeRequest(method, requestPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(body);
    const postData = isBuffer
      ? body
      : (typeof body === 'object' && body !== null ? JSON.stringify(body) : body);

    const reqHeaders = { ...headers };
    if (!isBuffer && typeof body === 'object' && body !== null && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: requestPath,
      method,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        let parsed = null;
        try {
          parsed = JSON.parse(rawBody.toString('utf-8'));
        } catch (e) {
          parsed = rawBody.toString('utf-8');
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          rawBody
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function buildMultipart(boundary, fields = {}, files = []) {
  const parts = [];

  // Add text fields
  Object.keys(fields).forEach((key) => {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${fields[key]}\r\n`
    ));
  });

  // Add files
  files.forEach((file) => {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.mimetype}\r\n\r\n`
    ));
    parts.push(file.buffer);
    parts.push(Buffer.from('\r\n'));
  });

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(parts)
  };
}

function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function runVerification() {
  console.log('====================================================');
  console.log(' TripPana Edit Place End-to-End Image Flow Verification');
  console.log('====================================================\n');

  const targetPlaceId = 1; // Panadura Beach

  // Step 1: Admin Login
  console.log('[Step 1] Logging in as Admin...');
  const loginRes = await makeRequest('POST', '/api/admin/login', {}, {
    username: 'admin',
    password: 'Admin@123'
  });
  assert(loginRes.status === 200, 'Admin login succeeds with 200');
  const token = loginRes.body.token;
  console.log('  ✓ Admin logged in successfully.');

  // Step 2: Note Initial DB rows for Place 1
  console.log(`\n[Step 2] Checking initial DB rows for Place ID ${targetPlaceId}...`);
  const initialRows = await queryDb('SELECT image_id, place_id, image_path, is_primary, display_order FROM place_images WHERE place_id = ?', [targetPlaceId]);
  console.log('  Initial place_images rows for place', targetPlaceId, ':', initialRows);

  // Step 3: Upload Initial Photo A
  console.log('\n[Step 3] Uploading initial Photo A to Place 1...');
  const boundaryA = '----BoundaryInitial' + Date.now();
  const multiA = buildMultipart(boundaryA, { set_primary: 'true' }, [
    { fieldname: 'images', filename: 'beach_original_day.jpg', mimetype: 'image/jpeg', buffer: createJpegBufferA() }
  ]);

  const uploadA = await makeRequest('POST', `/api/admin/places/${targetPlaceId}/images`, {
    Authorization: `Bearer ${token}`,
    'Content-Type': multiA.contentType
  }, multiA.body);

  assert(uploadA.status === 201, 'Upload A succeeds with 201');
  const photoA = uploadA.body.images[0];
  console.log('  ✓ Photo A uploaded:', photoA.image_path, '| is_primary:', photoA.is_primary);

  // Verify DB state after Photo A
  const rowsAfterA = await queryDb('SELECT image_id, place_id, image_path, is_primary, display_order FROM place_images WHERE place_id = ?', [targetPlaceId]);
  console.log('  DB rows after Photo A:', rowsAfterA);
  const primaryAfterA = rowsAfterA.find(r => r.is_primary === 1);
  assert(primaryAfterA && primaryAfterA.image_path === photoA.image_path, 'Photo A is currently the primary image');

  // Verify physical file on disk
  const physicalPathA = path.join(__dirname, '../server', photoA.image_path);
  assert(fs.existsSync(physicalPathA), `Physical file for Photo A exists at: ${physicalPathA}`);
  console.log('  ✓ Physical file for Photo A confirmed on disk:', physicalPathA);

  // Step 4: Simulate the exact Edit Place workflow:
  // Admin edits place details, chooses a new photo (Photo B), checks "Set as Primary", and clicks Save/Update
  console.log('\n[Step 4] Simulating Admin Edit Place workflow with replacement Photo B (Set as Primary = true)...');

  // 4a. Update place data (PUT /api/places/:id)
  const placeUpdateRes = await makeRequest('PUT', `/api/places/${targetPlaceId}`, {
    Authorization: `Bearer ${token}`
  }, {
    title: 'Panadura Beach (Verified Sunset Edition)',
    category_id: 1,
    description: 'A popular local coastal stretch ideal for evening walks and sunsets.',
    location: 'Panadura',
    address: 'Beach Road, Panadura',
    latitude: 6.7132,
    longitude: 79.9025,
    opening_hours: 'Open 24 Hours',
    entry_fee: 'Free',
    distance_from_panadura: null,
    travel_tips: 'Best visited during sunset hours; take care when swimming due to rough currents.'
  });
  assert(placeUpdateRes.status === 200, 'PUT /api/places/:id succeeds with HTTP 200');
  console.log('  ✓ Place details PUT update succeeded.');

  // 4b. Upload new replacement image Photo B with set_primary: 'true'
  const boundaryB = '----BoundaryReplacement' + Date.now();
  const multiB = buildMultipart(boundaryB, { set_primary: 'true' }, [
    { fieldname: 'images', filename: 'beach_replacement_sunset.jpg', mimetype: 'image/jpeg', buffer: createJpegBufferB() }
  ]);

  const uploadB = await makeRequest('POST', `/api/admin/places/${targetPlaceId}/images`, {
    Authorization: `Bearer ${token}`,
    'Content-Type': multiB.contentType
  }, multiB.body);

  assert(uploadB.status === 201, 'Upload B succeeds with HTTP 201');
  const photoB = uploadB.body.images[0];
  console.log('  ✓ Photo B uploaded:', photoB.image_path, '| is_primary:', photoB.is_primary);
  assert(photoB.is_primary === true, 'Photo B metadata reports is_primary = true');

  // Step 5: Check backend filesystem immediately after upload
  console.log('\n[Step 5] Checking backend filesystem for Photo B...');
  const physicalPathB = path.join(__dirname, '../server', photoB.image_path);
  assert(fs.existsSync(physicalPathB), `Physical file for Photo B exists at: ${physicalPathB}`);
  console.log('  ✓ Physical file for Photo B confirmed on disk:', physicalPathB);

  // Step 6: Query place_images DB table immediately after upload
  console.log('\n[Step 6] Querying place_images DB table for place', targetPlaceId, '...');
  const rowsAfterB = await queryDb('SELECT image_id, place_id, image_path, is_primary, display_order FROM place_images WHERE place_id = ? ORDER BY image_id ASC', [targetPlaceId]);
  console.table(rowsAfterB);

  const primaryRows = rowsAfterB.filter(r => r.is_primary === 1);
  assert(primaryRows.length === 1, `Exactly ONE row must have is_primary = 1 (found ${primaryRows.length})`);
  assert(primaryRows[0].image_path === photoB.image_path, 'The single primary row matches the newly uploaded Photo B!');
  console.log('  ✓ Exactly one primary row exists and points to Photo B:', primaryRows[0].image_path);

  const oldPhotoRow = rowsAfterB.find(r => r.image_path === photoA.image_path);
  assert(oldPhotoRow.is_primary === 0, 'Previous Photo A remains in gallery with is_primary = 0');
  console.log('  ✓ Previous Photo A remains in gallery with is_primary = 0');

  // Step 7: Check public API: GET /api/places/:id
  console.log('\n[Step 7] Testing public API: GET /api/places/:id...');
  const singleRes = await makeRequest('GET', `/api/places/${targetPlaceId}`);
  assert(singleRes.status === 200, 'GET /api/places/:id succeeds with HTTP 200');
  console.log('  GET /api/places/1 primary_image:', singleRes.body.primary_image);
  console.log('  GET /api/places/1 image_url:    ', singleRes.body.image_url);
  console.log('  GET /api/places/1 images count: ', singleRes.body.images.length);

  assert(singleRes.body.primary_image.includes(photoB.filename), 'Place details primary_image matches Photo B');
  assert(singleRes.body.image_url.includes(photoB.filename), 'Place details image_url matches Photo B');
  assert(singleRes.body.images.length >= 2, 'Gallery includes both uploaded photos');
  console.log('  ✓ Place details correctly serves newly uploaded Photo B as primary!');

  // Step 8: Check public API: GET /api/places (Homepage)
  console.log('\n[Step 8] Testing public API: GET /api/places (Homepage)...');
  const allRes = await makeRequest('GET', '/api/places');
  assert(allRes.status === 200, 'GET /api/places succeeds with HTTP 200');
  const homepagePlace1 = allRes.body.find(p => p.place_id === targetPlaceId);
  console.log('  Homepage Place 1 primary_image:', homepagePlace1.primary_image);
  console.log('  Homepage Place 1 image_url:    ', homepagePlace1.image_url);
  assert(homepagePlace1.primary_image.includes(photoB.filename), 'Homepage primary_image matches Photo B');
  assert(homepagePlace1.image_url.includes(photoB.filename), 'Homepage image_url matches Photo B');
  console.log('  ✓ Homepage correctly serves newly uploaded Photo B as primary!');

  // Step 9: Test Make Primary toggle back to Photo A
  console.log('\n[Step 9] Testing Admin "Make Primary" toggle back to Photo A...');
  const toggleRes = await makeRequest('PUT', `/api/admin/places/${targetPlaceId}/images/${photoA.image_id || oldPhotoRow.image_id}/primary`, {
    Authorization: `Bearer ${token}`
  });
  assert(toggleRes.status === 200, 'PUT /primary succeeds with HTTP 200');

  const rowsAfterToggle = await queryDb('SELECT image_id, place_id, image_path, is_primary FROM place_images WHERE place_id = ?', [targetPlaceId]);
  const primaryAfterToggle = rowsAfterToggle.find(r => r.is_primary === 1);
  assert(primaryAfterToggle.image_path === photoA.image_path, 'Photo A is now primary again');
  console.log('  ✓ Admin can immediately switch primary image back to Photo A via button.');

  // Step 10: Toggle back to Photo B
  console.log('\n[Step 10] Toggling primary back to Photo B...');
  const toggleBackRes = await makeRequest('PUT', `/api/admin/places/${targetPlaceId}/images/${photoB.image_id || primaryRows[0].image_id}/primary`, {
    Authorization: `Bearer ${token}`
  });
  assert(toggleBackRes.status === 200, 'PUT /primary back to Photo B succeeds with HTTP 200');
  console.log('  ✓ Photo B restored as primary image.');

  console.log('\n====================================================');
  console.log(' ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100%)');
  console.log('====================================================\n');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('\nVerification failed with error:', err);
  process.exit(1);
});
