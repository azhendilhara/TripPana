const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Tiny valid 1x1 JPEG buffer for testing
function createTestJpegBuffer() {
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

function buildMultipart(boundary, files) {
  const parts = [];
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

async function runTests() {
  console.log('====================================================');
  console.log(' TripPana Image URL Resolution & System Verification');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, condition) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ [PASS ${total}] ${name}`);
    } else {
      console.error(`  ✗ [FAIL ${total}] ${name}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  // 1. Authenticate as Admin
  console.log('[1] Logging in as Admin...');
  const adminLogin = await makeRequest('POST', '/api/admin/login', {}, {
    username: 'admin',
    password: 'Admin@123'
  });
  test('Admin login returns HTTP 200', adminLogin.status === 200);
  test('Admin login returns valid JWT token', Boolean(adminLogin.body.token));
  const adminToken = adminLogin.body.token;

  // 2. Upload real image to Place 1 (Panadura Beach)
  console.log('\n[2] Uploading image for Place 1 (Panadura Beach)...');
  const boundary = '----TripPanaTestBoundary' + Date.now();
  const testJpeg = createTestJpegBuffer();
  const multipart1 = buildMultipart(boundary, [
    { fieldname: 'images', filename: 'panadura_beach.jpg', mimetype: 'image/jpeg', buffer: testJpeg }
  ]);

  const uploadRes1 = await makeRequest(
    'POST',
    '/api/admin/places/1/images',
    {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': multipart1.contentType
    },
    multipart1.body
  );
  test('Admin upload to Place 1 returns HTTP 201', uploadRes1.status === 201);
  test('Place 1 upload returns images array', Array.isArray(uploadRes1.body.images) && uploadRes1.body.images.length === 1);
  const uploadedImage1 = uploadRes1.body.images[0];
  test('Place 1 image returns boolean is_primary', typeof uploadedImage1.is_primary === 'boolean');
  test('Place 1 image path starts with /uploads/places/', uploadedImage1.image_path.startsWith('/uploads/places/'));
  test('Place 1 full_url has port 5000', uploadedImage1.full_url.startsWith('http://localhost:5000/uploads/places/'));

  // 3. Upload real image to Place 2 (Rankoth Viharaya - has legacy Unsplash image)
  console.log('\n[3] Uploading image for Place 2 (Rankoth Viharaya - has legacy Unsplash image)...');
  const boundary2 = '----TripPanaTestBoundary2' + Date.now();
  const multipart2 = buildMultipart(boundary2, [
    { fieldname: 'images', filename: 'rankoth_temple.jpg', mimetype: 'image/jpeg', buffer: testJpeg }
  ]);

  const uploadRes2 = await makeRequest(
    'POST',
    '/api/admin/places/2/images',
    {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': multipart2.contentType
    },
    multipart2.body
  );
  test('Admin upload to Place 2 returns HTTP 201', uploadRes2.status === 201);
  const uploadedImage2 = uploadRes2.body.images[0];
  test('Place 2 image returns boolean is_primary', typeof uploadedImage2.is_primary === 'boolean');

  // 4. Test GET /api/places
  console.log('\n[4] Testing GET /api/places API output...');
  const allPlacesRes = await makeRequest('GET', '/api/places');
  test('GET /api/places returns HTTP 200', allPlacesRes.status === 200);
  test('GET /api/places returns all 10 attractions', allPlacesRes.body.length === 10);

  const place1 = allPlacesRes.body.find((p) => p.place_id === 1);
  test('Place 1 now has uploaded primary image populated', Boolean(place1.uploaded_primary_image));
  test('Place 1 image_url resolves to port 5000 full URL', place1.image_url.startsWith('http://localhost:5000/uploads/places/'));
  test('Place 1 primary_image resolves to port 5000 full URL', place1.primary_image.startsWith('http://localhost:5000/uploads/places/'));

  const place2 = allPlacesRes.body.find((p) => p.place_id === 2);
  test('Place 2 uploaded primary overrides legacy Unsplash image in primary_image',
    place2.primary_image.startsWith('http://localhost:5000/uploads/places/'));
  test('Place 2 uploaded primary overrides legacy Unsplash image in image_url',
    place2.image_url.startsWith('http://localhost:5000/uploads/places/'));

  const place3 = allPlacesRes.body.find((p) => p.place_id === 3);
  test('Place 3 (no uploaded image) preserves legacy Unsplash image',
    place3.image_url && place3.image_url.startsWith('https://images.unsplash.com'));

  // 5. Test GET /api/places/:id
  console.log('\n[5] Testing GET /api/places/:id...');
  const singlePlaceRes = await makeRequest('GET', '/api/places/1');
  test('GET /api/places/1 returns HTTP 200', singlePlaceRes.status === 200);
  test('GET /api/places/1 includes primary_image', singlePlaceRes.body.primary_image.startsWith('http://localhost:5000/uploads/places/'));
  test('GET /api/places/1 includes images array', Array.isArray(singlePlaceRes.body.images) && singlePlaceRes.body.images.length >= 1);

  // 6. Test GET /api/places/:id/images
  console.log('\n[6] Testing GET /api/places/:id/images...');
  const imagesRes = await makeRequest('GET', '/api/places/1/images');
  test('GET /api/places/1/images returns HTTP 200', imagesRes.status === 200);
  test('GET /api/places/1/images contains our uploaded image', imagesRes.body.some((i) => i.image_path === uploadedImage1.image_path));

  // 7. Direct static-file test from database path
  console.log('\n[7] Direct static-file test on Express endpoint...');
  const staticPath = uploadedImage1.image_path; // e.g. /uploads/places/place_1_...
  const staticRes = await makeRequest('GET', staticPath);
  test('Static file request returns HTTP 200', staticRes.status === 200);
  test('Static file returns image/jpeg Content-Type', staticRes.headers['content-type'] === 'image/jpeg');
  test('Static file returns valid non-zero buffer', staticRes.rawBody.length > 0);

  // 8. Test resolveImageUrl logic across all formats
  console.log('\n[8] Testing frontend resolveImageUrl logic...');
  const { resolveImageUrl, PLACEHOLDER_IMAGE, API_BASE_URL } = await import('../client/src/utils/imageUrl.js');

  test('resolveImageUrl with /uploads/places/... resolves to http://localhost:5000/uploads/...',
    resolveImageUrl('/uploads/places/panadura.jpg') === 'http://localhost:5000/uploads/places/panadura.jpg');
  test('resolveImageUrl with uploads/places/... (no leading slash) resolves properly',
    resolveImageUrl('uploads/places/panadura.jpg') === 'http://localhost:5000/uploads/places/panadura.jpg');
  test('resolveImageUrl with https://images.unsplash.com/... returns unchanged',
    resolveImageUrl('https://images.unsplash.com/photo-1548625149-fc4a29cf7092') === 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092');
  test('resolveImageUrl with http://example.com/pic.jpg returns unchanged',
    resolveImageUrl('http://example.com/pic.jpg') === 'http://example.com/pic.jpg');
  test('resolveImageUrl with null returns /placeholder.jpg',
    resolveImageUrl(null) === '/placeholder.jpg');
  test('resolveImageUrl with empty string returns /placeholder.jpg',
    resolveImageUrl('') === '/placeholder.jpg');
  test('resolveImageUrl with undefined returns /placeholder.jpg',
    resolveImageUrl(undefined) === '/placeholder.jpg');

  // 9. Verify local placeholder file exists on disk
  console.log('\n[9] Verifying local placeholder.jpg asset...');
  const placeholderExists = fs.existsSync(path.join(__dirname, '../client/public/placeholder.jpg'));
  test('client/public/placeholder.jpg exists', placeholderExists);
  const placeholderBytes = fs.readFileSync(path.join(__dirname, '../client/public/placeholder.jpg'));
  test('client/public/placeholder.jpg is a non-empty JPEG file', placeholderBytes.length > 1000);

  console.log('\n====================================================');
  console.log(` ALL TESTS COMPLETED: ${passed} / ${total} PASSED (100%)`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\nTest suite failed with error:', err);
  process.exit(1);
});
