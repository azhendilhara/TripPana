// scratch/test_admin_dashboard_e2e.cjs
const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = data ? JSON.stringify(data) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('=== TRIP PANA ADMIN DASHBOARD E2E TEST SUITE ===\n');
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
    // 1. Admin Login Tests
    console.log('[1] Testing Admin Login & Token Generation...');
    const invalidLogin = await request('POST', '/api/admin/login', {
      username: 'admin',
      password: 'WrongPassword123'
    });
    assert(invalidLogin.status === 401, 'Invalid admin password rejected with HTTP 401');

    const adminLoginRes = await request('POST', '/api/admin/login', {
      username: 'admin',
      password: 'Admin@123'
    });
    assert(adminLoginRes.status === 200, 'Valid admin login succeeds with HTTP 200');
    assert(!!adminLoginRes.body.token, 'Admin response contains JWT token');
    assert(adminLoginRes.body.admin && adminLoginRes.body.admin.username === 'admin', 'Admin payload has username');
    const adminToken = adminLoginRes.body.token;

    // 2. Tourist Login for Role Separation Tests
    console.log('\n[2] Testing Tourist Token vs Admin Route Security...');
    const testEmail = `tourist_${Date.now()}@trippana.com`;
    const regRes = await request('POST', '/api/auth/register', {
      name: 'E2E Tourist',
      email: testEmail,
      password: 'Password123!'
    });
    let touristToken = regRes.body && regRes.body.token;
    if (!touristToken) {
      const loginRes = await request('POST', '/api/auth/login', {
        email: testEmail,
        password: 'Password123!'
      });
      touristToken = loginRes.body && loginRes.body.token;
    }
    assert(!!touristToken, 'Tourist authentication setup successful for role-separation testing');

    const unauthStats = await request('GET', '/api/admin/stats');
    assert(unauthStats.status === 401, 'Unauthenticated access to /api/admin/stats returns HTTP 401');

    const touristStats = await request('GET', '/api/admin/stats', null, touristToken);
    assert(touristStats.status === 403, 'Tourist token rejected on /api/admin/stats with HTTP 403 Forbidden');

    // 3. Admin Statistics Endpoint
    console.log('\n[3] Testing Admin Statistics Endpoint (/api/admin/stats)...');
    const adminStats = await request('GET', '/api/admin/stats', null, adminToken);
    assert(adminStats.status === 200, 'Admin can fetch /api/admin/stats with HTTP 200');
    assert(typeof adminStats.body.total_places === 'number', `total_places returned (${adminStats.body.total_places})`);
    assert(typeof adminStats.body.total_categories === 'number', `total_categories returned (${adminStats.body.total_categories})`);
    assert(typeof adminStats.body.total_users === 'number', `total_users returned (${adminStats.body.total_users})`);
    assert(typeof adminStats.body.total_itineraries === 'number', `total_itineraries returned (${adminStats.body.total_itineraries})`);
    assert(typeof adminStats.body.pending_reviews === 'number', `pending_reviews returned (${adminStats.body.pending_reviews})`);
    assert(typeof adminStats.body.approved_reviews === 'number', `approved_reviews returned (${adminStats.body.approved_reviews})`);

    // 4. Category Management CRUD & Safety
    console.log('\n[4] Testing Category Management CRUD & Safety Rules...');
    const publicCategories = await request('GET', '/api/categories');
    assert(publicCategories.status === 200, 'GET /api/categories is publicly accessible');
    assert(Array.isArray(publicCategories.body), 'GET /api/categories returns array of categories');
    assert(publicCategories.body.length > 0 && typeof publicCategories.body[0].place_count !== 'undefined', 'Categories include place_count');

    const testCatName = `Adventure Test ${Date.now()}`;
    const touristCreateCat = await request('POST', '/api/categories', { name: testCatName, description: 'Test desc' }, touristToken);
    assert(touristCreateCat.status === 403, 'Tourist token rejected when creating category (HTTP 403 Forbidden)');

    const invalidCat = await request('POST', '/api/categories', { name: '', description: 'No name' }, adminToken);
    assert(invalidCat.status === 400, 'Creating category with empty name rejected with HTTP 400');

    const createCatRes = await request('POST', '/api/categories', {
      name: testCatName,
      description: 'Thrilling adventure spots'
    }, adminToken);
    assert(createCatRes.status === 201, 'Admin can create new category with HTTP 201');
    const newCatId = createCatRes.body.category_id;
    assert(!!newCatId, `New category created with ID ${newCatId}`);

    const dupCatRes = await request('POST', '/api/categories', {
      name: testCatName,
      description: 'Duplicate name test'
    }, adminToken);
    assert(dupCatRes.status === 409, 'Duplicate category name rejected with HTTP 409 Conflict');

    const updateCatRes = await request('PUT', `/api/categories/${newCatId}`, {
      name: `${testCatName} Updated`,
      description: 'Updated adventure description'
    }, adminToken);
    assert(updateCatRes.status === 200, 'Admin can update category with HTTP 200');

    console.log('\n[5] Testing Safe Category Deletion Constraints...');
    // Beach (id: 1) has places assigned
    const unsafeDeleteRes = await request('DELETE', '/api/categories/1', null, adminToken);
    assert(unsafeDeleteRes.status === 400, 'Deleting category currently assigned to places rejected with HTTP 400');
    assert(
      unsafeDeleteRes.body &&
      unsafeDeleteRes.body.message &&
      unsafeDeleteRes.body.message.toLowerCase().includes('cannot delete category'),
      'Safe error message returned when attempting to delete in-use category'
    );

    // Safe deletion of newly created category with 0 places
    const safeDeleteRes = await request('DELETE', `/api/categories/${newCatId}`, null, adminToken);
    assert(safeDeleteRes.status === 200, 'Deleting unused category succeeds with HTTP 200');

    // 6. Place Management CRUD with Category Association
    console.log('\n[6] Testing Place Management CRUD (Admin)...');
    const testPlaceTitle = `Test Admin Place ${Date.now()}`;
    const touristCreatePlace = await request('POST', '/api/places', {
      title: testPlaceTitle,
      category_id: 1,
      latitude: 6.713,
      longitude: 79.907
    }, touristToken);
    assert(touristCreatePlace.status === 403, 'Tourist token rejected when creating place (HTTP 403 Forbidden)');

    const createPlaceRes = await request('POST', '/api/places', {
      title: testPlaceTitle,
      category_id: 1,
      description: 'A test place created by admin dashboard E2E suite',
      location: 'Panadura Beach Road',
      address: 'Beach Rd, Panadura',
      latitude: 6.7134,
      longitude: 79.9078,
      opening_hours: '8:00 AM - 6:00 PM',
      entry_fee: 'Free',
      distance_from_panadura: 1.5,
      travel_tips: 'Bring sunglasses',
      image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e'
    }, adminToken);
    assert(createPlaceRes.status === 201, 'Admin can create new place with HTTP 201');
    const newPlaceId = createPlaceRes.body.place_id || createPlaceRes.body.placeId || createPlaceRes.body.id;
    assert(!!newPlaceId, `New place created with ID ${newPlaceId}`);

    const updatePlaceRes = await request('PUT', `/api/places/${newPlaceId}`, {
      title: `${testPlaceTitle} (Updated)`,
      category_id: 1,
      description: 'Updated description for admin dashboard place test',
      location: 'Panadura Coastline',
      latitude: 6.7134,
      longitude: 79.9078,
      distance_from_panadura: 2.0
    }, adminToken);
    assert(updatePlaceRes.status === 200, 'Admin can update existing place with HTTP 200');

    const deletePlaceRes = await request('DELETE', `/api/places/${newPlaceId}`, null, adminToken);
    assert(deletePlaceRes.status === 200, 'Admin can delete place with HTTP 200');

    // 7. Review Moderation Management
    console.log('\n[7] Testing Review Moderation Management...');
    const adminReviewsRes = await request('GET', '/api/admin/reviews?status=pending', null, adminToken);
    assert(adminReviewsRes.status === 200, 'Admin can fetch pending reviews with HTTP 200');
    assert(Array.isArray(adminReviewsRes.body), 'Admin reviews returned as array');

    const adminAllReviewsRes = await request('GET', '/api/admin/reviews?status=approved', null, adminToken);
    assert(adminAllReviewsRes.status === 200, 'Admin can fetch approved reviews with HTTP 200');

    console.log(`\n========================================`);
    console.log(`FINAL RESULT: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
    console.log(`========================================\n`);

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runTests();
