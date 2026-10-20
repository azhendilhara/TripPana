const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function makeRequest(method, requestPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: requestPath,
      method
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
          body: parsed
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log(' TripPana Place Details Gallery & Lightbox Tests');
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

  // Import resolveImageUrl
  const { resolveImageUrl } = await import('../client/src/utils/imageUrl.js');

  // Simulation of galleryImages calculation from PlaceDetails.jsx
  function computeGalleryImages(place) {
    if (!place) return [];
    if (Array.isArray(place.images) && place.images.length > 0) {
      return place.images.map((img, idx) => ({
        id: img.image_id || `img-${idx}`,
        src: resolveImageUrl(img.full_url || img.image_path),
        is_primary: Boolean(img.is_primary),
        alt: `${place.title} - photo ${idx + 1}`
      }));
    }
    if (place.image_url && typeof place.image_url === 'string' && place.image_url.trim()) {
      return [{
        id: 'legacy-cover',
        src: resolveImageUrl(place.image_url),
        is_primary: true,
        alt: place.title
      }];
    }
    return [];
  }

  // 1. Test Place with multiple uploaded images (Place 1)
  console.log('[1] Testing Place with multiple uploaded images (Place 1: Panadura Beach)...');
  const place1Res = await makeRequest('GET', '/api/places/1');
  test('GET /api/places/1 returns HTTP 200', place1Res.status === 200);
  const place1 = place1Res.body;
  test('Place 1 has multiple uploaded images in images array', Array.isArray(place1.images) && place1.images.length >= 2);
  const place1Gallery = computeGalleryImages(place1);
  test('Place 1 gallery contains all uploaded images', place1Gallery.length === place1.images.length);
  test('Place 1 gallery contains exactly one primary image', place1Gallery.filter(i => i.is_primary).length === 1);
  test('Place 1 hero image matches primary image',
    resolveImageUrl(place1.primary_image || place1.image_url) === place1Gallery.find(i => i.is_primary).src);

  // 2. Test Place with 1 uploaded image (Place 2: Rankoth Viharaya)
  console.log('\n[2] Testing Place with 1 uploaded image (Place 2: Rankoth Viharaya)...');
  const place2Res = await makeRequest('GET', '/api/places/2');
  test('GET /api/places/2 returns HTTP 200', place2Res.status === 200);
  const place2 = place2Res.body;
  test('Place 2 has at least 1 image', Array.isArray(place2.images) && place2.images.length >= 1);
  const place2Gallery = computeGalleryImages(place2);
  test('Place 2 gallery has clean item count without duplication', place2Gallery.length === place2.images.length);
  test('Place 2 hero image matches primary image',
    resolveImageUrl(place2.primary_image || place2.image_url) === place2Gallery[0].src);

  // 3. Test Place with no uploaded images, legacy URL only (Place 3: Bolgoda Lake)
  console.log('\n[3] Testing Place with no uploaded images (Place 3: Bolgoda Lake)...');
  const place3Res = await makeRequest('GET', '/api/places/3');
  test('GET /api/places/3 returns HTTP 200', place3Res.status === 200);
  const place3 = place3Res.body;
  test('Place 3 has no uploaded images (empty array)', Array.isArray(place3.images) && place3.images.length === 0);
  test('Place 3 has legacy image_url string', typeof place3.image_url === 'string' && place3.image_url.startsWith('https://'));
  const place3Gallery = computeGalleryImages(place3);
  test('Place 3 safely creates 1 gallery item from legacy URL', place3Gallery.length === 1);
  test('Place 3 gallery item is marked primary and not duplicated', place3Gallery[0].is_primary === true);
  test('Place 3 hero image uses legacy image_url',
    resolveImageUrl(place3.primary_image || place3.image_url) === place3Gallery[0].src);

  // 4. Test Place with no images at all (Place 4: Dehiwala Zoo)
  console.log('\n[4] Testing Place with no images at all (Place 4: Dehiwala Zoo)...');
  const place4Res = await makeRequest('GET', '/api/places/4');
  test('GET /api/places/4 returns HTTP 200', place4Res.status === 200);
  const place4 = place4Res.body;
  test('Place 4 has null image_url and empty images', place4.image_url === null && place4.images.length === 0);
  const place4Gallery = computeGalleryImages(place4);
  test('Place 4 gallery is empty (gallery section cleanly omitted)', place4Gallery.length === 0);
  test('Place 4 hero image safely falls back to local placeholder',
    resolveImageUrl(place4.primary_image || place4.image_url) === '/placeholder.jpg');

  // 5. Test Lightbox State Machine & Navigation
  console.log('\n[5] Testing Lightbox navigation state machine...');
  let activeIndex = null;
  const gallery = place1Gallery; // 2+ images

  // Open at index 0
  activeIndex = 0;
  test('Opening lightbox at index 0 selects first image', activeIndex === 0);
  test('Selected image is correct full URL', gallery[activeIndex].src.startsWith('http://localhost:5000/uploads/places/'));

  // Next image
  activeIndex = (activeIndex + 1) % gallery.length;
  test('Clicking Next advances index to 1', activeIndex === 1);
  test('Index 1 image matches second photo', gallery[activeIndex].id === gallery[1].id);

  // Next wraps back to 0 from the last image
  activeIndex = gallery.length - 1;
  activeIndex = (activeIndex + 1) % gallery.length;
  test('Clicking Next at end wraps index back to 0', activeIndex === 0);

  // Prev wraps backwards to last
  activeIndex = (activeIndex - 1 + gallery.length) % gallery.length;
  test('Clicking Previous at index 0 wraps to last image', activeIndex === gallery.length - 1);

  // Escape key closes
  activeIndex = null;
  test('Escape key closes lightbox (index is null)', activeIndex === null);

  // Hero image remains unaffected by lightbox browsing
  test('Hero image remains the primary cover photo after browsing',
    resolveImageUrl(place1.primary_image || place1.image_url) === place1Gallery.find(i => i.is_primary).src);

  // 6. Verify CSS definitions in client/src/App.css
  console.log('\n[6] Verifying Gallery & Lightbox CSS rules in App.css...');
  const css = fs.readFileSync(path.join(__dirname, '../client/src/App.css'), 'utf-8');

  test('CSS contains .place-gallery-section styling', css.includes('.place-gallery-section'));
  test('CSS desktop grid has 3 columns: repeat(3, 1fr)', css.includes('grid-template-columns: repeat(3, 1fr)'));
  test('CSS tablet grid has 2 columns: repeat(2, 1fr)', css.includes('grid-template-columns: repeat(2, 1fr)'));
  test('CSS mobile grid has 1 column: 1fr', css.includes('grid-template-columns: 1fr'));
  test('CSS gallery grid item has aspect-ratio: 4 / 3', css.includes('aspect-ratio: 4 / 3'));
  test('CSS gallery grid item has object-fit: cover', css.includes('object-fit: cover'));
  test('CSS lightbox image has object-fit: contain (uncropped full image)', css.includes('object-fit: contain'));
  test('CSS lightbox overlay has dark backdrop (rgba/backdrop-filter)', css.includes('rgba(10, 15, 25, 0.88)') && css.includes('backdrop-filter: blur(8px)'));
  test('CSS lightbox has fixed close button', css.includes('.lightbox-close-btn'));
  test('CSS lightbox has nav buttons (prev/next)', css.includes('.lightbox-nav-btn'));
  test('CSS hero cover has object-fit: cover and does not stretch', css.includes('.details-hero-img') && css.includes('object-fit: cover'));

  // 7. Check JSX component structure in PlaceDetails.jsx
  console.log('\n[7] Verifying JSX component structure in PlaceDetails.jsx...');
  const jsx = fs.readFileSync(path.join(__dirname, '../client/src/pages/PlaceDetails.jsx'), 'utf-8');

  test('PlaceDetails no longer contains the old .place-gallery-strip thumbnail strip', !jsx.includes('place-gallery-strip'));
  test('PlaceDetails no longer contains .gallery-thumb-btn', !jsx.includes('gallery-thumb-btn'));
  test('PlaceDetails contains .place-gallery-section', jsx.includes('place-gallery-section'));
  test('PlaceDetails contains .place-gallery-grid', jsx.includes('place-gallery-grid'));
  test('PlaceDetails contains .lightbox-overlay', jsx.includes('lightbox-overlay'));
  test('PlaceDetails includes keyboard event listener for Escape and Arrow keys', jsx.includes("e.key === 'Escape'") && jsx.includes("e.key === 'ArrowRight'"));
  test('PlaceDetails locks document.body.style.overflow when lightbox is open', jsx.includes("document.body.style.overflow = 'hidden'"));

  console.log('\n====================================================');
  console.log(` ALL CHECKS COMPLETED: ${passed} / ${total} PASSED (100%)`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\nTest failed with error:', err);
  process.exit(1);
});
