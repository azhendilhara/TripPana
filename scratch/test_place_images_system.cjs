const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqHeaders = { ...headers };

    if (body && !Buffer.isBuffer(body) && typeof body === 'object') {
      body = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
    }

    if (body) {
      reqHeaders['Content-Length'] = Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(resBody);
          } catch {
            parsed = resBody;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Multipart form data helper without external dependency
function buildMultipartBody(fields = {}, files = []) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const chunks = [];

  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`
      )
    );
    chunks.push(file.content);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const fullBody = Buffer.concat(chunks);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: fullBody
  };
}

// Helper: 1x1 valid PNG buffer
function createTinyPngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
}

// Helper: 1x1 valid JPEG buffer
function createTinyJpegBuffer() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64'
  );
}

async function runSuite() {
  console.log('=== TRIP PANA PLACE MULTIPLE IMAGES SYSTEM E2E TEST ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  try {
    // 1. Authenticate as Admin
    console.log('[1] Authenticating Admin & Tourist for security verification...');
    const adminLogin = await makeRequest('POST', '/api/admin/login', {}, { username: 'admin', password: 'Admin@123' });
    assert(adminLogin.status === 200 && !!adminLogin.body.token, 'Admin login succeeds and returns JWT');
    const adminToken = adminLogin.body.token;

    const touristEmail = `tourist_${Date.now()}@trippana.com`;
    const touristReg = await makeRequest('POST', '/api/auth/register', {}, {
      name: 'Image Test Tourist',
      email: touristEmail,
      password: 'Password123!'
    });
    const touristToken = touristReg.body.token;
    assert(!!touristToken, 'Tourist token acquired for role-rejection testing');

    // Create a temporary test place so we don't mess up real places
    console.log('\n[2] Creating temporary test place for image operations...');
    const createPlaceRes = await makeRequest(
      'POST',
      '/api/places',
      { Authorization: `Bearer ${adminToken}` },
      {
        title: `Temp Place Image Test ${Date.now()}`,
        category_id: 1,
        location: 'Panadura',
        description: 'Temporary place to test image uploads',
        image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e'
      }
    );
    assert(createPlaceRes.status === 201, 'Temporary place created');
    const testPlaceId = createPlaceRes.body.place_id;

    // 3. Security checks
    console.log('\n[3] Testing upload authorization and file validation...');
    const validPng = createTinyPngBuffer();
    const uploadPayload = buildMultipartBody({}, [
      { field: 'images', name: 'photo1.png', type: 'image/png', content: validPng }
    ]);

    // Unauthenticated upload
    const unauthUpload = await makeRequest('POST', `/api/admin/places/${testPlaceId}/images`, {
      'Content-Type': uploadPayload.contentType
    }, uploadPayload.body);
    assert(unauthUpload.status === 401, 'Unauthenticated upload rejected with HTTP 401');

    // Tourist upload
    const touristUpload = await makeRequest(
      'POST',
      `/api/admin/places/${testPlaceId}/images`,
      {
        Authorization: `Bearer ${touristToken}`,
        'Content-Type': uploadPayload.contentType
      },
      uploadPayload.body
    );
    assert(touristUpload.status === 403, 'Tourist upload rejected with HTTP 403 Forbidden');

    // Non-image upload (e.g. text file)
    const textPayload = buildMultipartBody({}, [
      { field: 'images', name: 'malicious.txt', type: 'text/plain', content: Buffer.from('Hello world') }
    ]);
    const nonImageUpload = await makeRequest(
      'POST',
      `/api/admin/places/${testPlaceId}/images`,
      {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': textPayload.contentType
      },
      textPayload.body
    );
    assert(nonImageUpload.status === 400, 'Non-image file rejected with HTTP 400');

    // Oversized image upload (> 5 MB)
    const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0); // 5.5 MB
    const oversizedPayload = buildMultipartBody({}, [
      { field: 'images', name: 'giant.jpg', type: 'image/jpeg', content: oversizedBuffer }
    ]);
    const oversizedUpload = await makeRequest(
      'POST',
      `/api/admin/places/${testPlaceId}/images`,
      {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': oversizedPayload.contentType
      },
      oversizedPayload.body
    );
    assert(oversizedUpload.status === 400, 'Oversized file (>5MB) rejected with HTTP 400');

    // 4. Admin uploads first image -> must automatically become primary
    console.log('\n[4] Testing single image upload and primary assignment...');
    const upload1 = await makeRequest(
      'POST',
      `/api/admin/places/${testPlaceId}/images`,
      {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': uploadPayload.contentType
      },
      uploadPayload.body
    );
    assert(upload1.status === 201, 'Admin upload single image succeeds with HTTP 201');
    assert(upload1.body.images && upload1.body.images.length === 1, 'Returns uploaded image metadata');

    const firstImage = upload1.body.images[0];
    assert(firstImage.is_primary === true, 'First uploaded image is automatically marked as primary');

    // 5. Admin uploads multiple images at once
    console.log('\n[5] Testing multiple images upload at once...');
    const jpeg1 = createTinyJpegBuffer();
    const jpeg2 = createTinyJpegBuffer();
    const multiPayload = buildMultipartBody({}, [
      { field: 'images', name: 'photo2.jpg', type: 'image/jpeg', content: jpeg1 },
      { field: 'images', name: 'photo3.jpg', type: 'image/jpeg', content: jpeg2 }
    ]);

    const uploadMulti = await makeRequest(
      'POST',
      `/api/admin/places/${testPlaceId}/images`,
      {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': multiPayload.contentType
      },
      multiPayload.body
    );
    assert(uploadMulti.status === 201, 'Multiple images upload succeeds with HTTP 201');
    assert(uploadMulti.body.images && uploadMulti.body.images.length === 2, '2 new images uploaded');
    assert(uploadMulti.body.images[0].is_primary === false, 'Subsequent uploaded image is not primary');

    // 6. Fetch all images for place
    console.log('\n[6] Fetching images list for place...');
    const listRes = await makeRequest('GET', `/api/places/${testPlaceId}/images`);
    assert(listRes.status === 200, 'GET /api/places/:id/images returns HTTP 200');
    assert(listRes.body.length === 3, 'Place has 3 uploaded images');

    const primaryImages = listRes.body.filter((i) => i.is_primary);
    assert(primaryImages.length === 1, 'Exactly one primary image exists');

    const secondImageId = listRes.body.find((i) => !i.is_primary).image_id;

    // 7. Change primary image
    console.log('\n[7] Changing primary image...');
    const setPrimaryRes = await makeRequest(
      'PUT',
      `/api/admin/places/${testPlaceId}/images/${secondImageId}/primary`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(setPrimaryRes.status === 200, 'PUT /api/admin/places/:id/images/:imageId/primary succeeds with HTTP 200');

    const updatedList = await makeRequest('GET', `/api/places/${testPlaceId}/images`);
    const newPrimary = updatedList.body.find((i) => i.is_primary);
    assert(newPrimary && newPrimary.image_id === secondImageId, 'Second image is now the primary image');
    assert(updatedList.body.filter((i) => i.is_primary).length === 1, 'Still exactly one primary image');

    // 8. Delete non-primary image
    console.log('\n[8] Deleting non-primary image...');
    const thirdImageId = updatedList.body.find((i) => !i.is_primary).image_id;
    const deleteNonPrimary = await makeRequest(
      'DELETE',
      `/api/admin/places/${testPlaceId}/images/${thirdImageId}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(deleteNonPrimary.status === 200, 'DELETE non-primary image succeeds with HTTP 200');

    const afterDelList = await makeRequest('GET', `/api/places/${testPlaceId}/images`);
    assert(afterDelList.body.length === 2, 'Total images reduced to 2');
    assert(afterDelList.body.some((i) => i.image_id === secondImageId && i.is_primary), 'Primary image was unchanged');

    // 9. Delete primary image -> must promote next image to primary
    console.log('\n[9] Deleting primary image & testing auto-promotion...');
    const deletePrimary = await makeRequest(
      'DELETE',
      `/api/admin/places/${testPlaceId}/images/${secondImageId}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(deletePrimary.status === 200, 'DELETE primary image succeeds with HTTP 200');
    assert(deletePrimary.body.was_primary === true, 'Response indicates deleted image was primary');

    const finalImageList = await makeRequest('GET', `/api/places/${testPlaceId}/images`);
    assert(finalImageList.body.length === 1, '1 image remains');
    assert(finalImageList.body[0].is_primary === true, 'Remaining image automatically promoted to primary');

    // 10. Public Place Details API output
    console.log('\n[10] Verifying public place details & fallback behavior...');
    const placeDetails = await makeRequest('GET', `/api/places/${testPlaceId}`);
    assert(placeDetails.status === 200, 'GET /api/places/:id returns HTTP 200');
    assert(placeDetails.body.primary_image === finalImageList.body[0].full_url, 'primary_image reflects uploaded image');
    assert(placeDetails.body.images && placeDetails.body.images.length === 1, 'images array populated in place details');

    // Check place with NO uploaded images (e.g. Place 1)
    const place1Res = await makeRequest('GET', '/api/places/1');
    assert(place1Res.status === 200, 'GET /api/places/1 returns HTTP 200');
    assert(
      place1Res.body.primary_image === 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
      'Place without uploaded images falls back to places.image_url'
    );

    // 11. Foreign Key Cascade on Place Deletion
    console.log('\n[11] Verifying MySQL cascade deletion on place delete...');
    const deletePlaceRes = await makeRequest(
      'DELETE',
      `/api/places/${testPlaceId}`,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(deletePlaceRes.status === 200, 'Test place deleted');

    const orphanImagesCheck = await makeRequest('GET', `/api/places/${testPlaceId}/images`);
    assert(orphanImagesCheck.body.length === 0, 'Cascading delete removed all place_images records automatically');

    console.log(`\n========================================`);
    console.log(`FINAL RESULT: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
    console.log(`========================================\n`);

    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runSuite();
