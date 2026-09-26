import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from '../server/routes/api.js';
import { deleteBusinessBySlug, closeDb } from '../server/db/mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

const clientDistPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const TEST_PORT = 5098;

const server = app.listen(TEST_PORT, async () => {
  console.log(`📡 Multi-Business API Test Server running on port ${TEST_PORT}`);

  try {
    // 1. Test GET /api/businesses (should return multiple businesses)
    console.log('Testing GET /api/businesses...');
    const resList = await fetch(`http://localhost:${TEST_PORT}/api/businesses`);
    assert.equal(resList.status, 200);
    const dataList = await resList.json();
    assert.equal(dataList.success, true);
    assert(Array.isArray(dataList.data));
    assert(dataList.data.length >= 3, 'Should have at least 3 businesses');

    const slugs = dataList.data.map(b => b.slug);
    assert(slugs.includes('demo-waffle-shop'), 'Missing demo-waffle-shop');
    assert(slugs.includes('royal-cafe'), 'Missing royal-cafe');
    assert(slugs.includes('fresh-mart'), 'Missing fresh-mart');
    console.log('  ✓ GET /api/businesses returned all configured businesses:', slugs.join(', '));

    // 2. Test GET /api/businesses/royal-cafe
    console.log('Testing GET /api/businesses/royal-cafe...');
    const resCafe = await fetch(`http://localhost:${TEST_PORT}/api/businesses/royal-cafe`);
    assert.equal(resCafe.status, 200);
    const dataCafe = await resCafe.json();
    assert.equal(dataCafe.data.name, 'Royal Cafe');
    assert.equal(dataCafe.data.type, 'cafe');
    assert(dataCafe.data.googleReviewUrl.length > 0);
    console.log('  ✓ GET /api/businesses/royal-cafe returned correct details');

    // 3. Test GET /api/businesses/fresh-mart
    console.log('Testing GET /api/businesses/fresh-mart...');
    const resMart = await fetch(`http://localhost:${TEST_PORT}/api/businesses/fresh-mart`);
    assert.equal(resMart.status, 200);
    const dataMart = await resMart.json();
    assert.equal(dataMart.data.name, 'Fresh Mart');
    assert.equal(dataMart.data.type, 'grocery store');
    console.log('  ✓ GET /api/businesses/fresh-mart returned correct details');

    // 4. Test GET /api/businesses/demo-waffle-shop
    console.log('Testing GET /api/businesses/demo-waffle-shop...');
    const resWaffle = await fetch(`http://localhost:${TEST_PORT}/api/businesses/demo-waffle-shop`);
    assert.equal(resWaffle.status, 200);
    const dataWaffle = await resWaffle.json();
    assert.equal(dataWaffle.data.name, 'Demo Waffle Shop');
    assert.equal(dataWaffle.data.type, 'waffle shop');
    console.log('  ✓ GET /api/businesses/demo-waffle-shop returned correct details');

    // 5. Test PATCH /api/businesses/royal-cafe
    console.log('Testing PATCH /api/businesses/royal-cafe...');
    const newGoogleUrl = 'https://search.google.com/local/writereview?placeid=ROYAL_CAFE_CUSTOM_PLACE';
    const resPatch = await fetch(`http://localhost:${TEST_PORT}/api/businesses/royal-cafe`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleReviewUrl: newGoogleUrl })
    });
    assert.equal(resPatch.status, 200);
    const dataPatch = await resPatch.json();
    assert.equal(dataPatch.data.googleReviewUrl, newGoogleUrl);
    console.log('  ✓ Successfully updated Royal Cafe Google URL');

    // 6. Test POST /api/businesses (Create business)
    console.log('Testing POST /api/businesses (Create business)...');
    const resCreate = await fetch(`http://localhost:${TEST_PORT}/api/businesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Burger Fam',
        googleReviewUrl: 'https://search.google.com/local/writereview?placeid=BURGER_FAM_123',
        aiContext: 'Gourmet burgers and fries'
      })
    });
    assert.equal(resCreate.status, 201);
    const dataCreate = await resCreate.json();
    assert.equal(dataCreate.success, true);
    assert.equal(dataCreate.data.name, 'Burger Fam');
    assert.equal(dataCreate.data.slug, 'burger-fam');
    assert.equal(dataCreate.data.status, 'active');
    assert(dataCreate.data.createdAt);
    assert(dataCreate.data.updatedAt);
    console.log('  ✓ POST /api/businesses successfully created "Burger Fam" with status: active');

    // 7. Test GET /api/businesses/burger-fam (Active business loads)
    console.log('Testing GET /api/businesses/burger-fam (Active business loads)...');
    const resGetCreated = await fetch(`http://localhost:${TEST_PORT}/api/businesses/burger-fam`);
    assert.equal(resGetCreated.status, 200);
    const dataGetCreated = await resGetCreated.json();
    assert.equal(dataGetCreated.data.slug, 'burger-fam');
    assert.equal(dataGetCreated.data.status, 'active');
    console.log('  ✓ GET /api/businesses/burger-fam loaded active business configuration');

    // 8. Test PATCH /api/businesses/burger-fam/status (Suspend business)
    console.log('Testing PATCH /api/businesses/burger-fam/status (Suspend business)...');
    const resSuspend = await fetch(`http://localhost:${TEST_PORT}/api/businesses/burger-fam/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' })
    });
    assert.equal(resSuspend.status, 200);
    const dataSuspend = await resSuspend.json();
    assert.equal(dataSuspend.data.status, 'suspended');

    const resCheckSuspended = await fetch(`http://localhost:${TEST_PORT}/api/businesses/burger-fam`);
    assert.equal(resCheckSuspended.status, 200);
    const dataCheckSuspended = await resCheckSuspended.json();
    assert.equal(dataCheckSuspended.data.status, 'suspended');
    console.log('  ✓ PATCH /api/businesses/burger-fam/status successfully updated status to suspended');

    // 9. Test unknown slug 404
    console.log('Testing GET /api/businesses/unknown-non-existent-slug (404)...');
    const res404 = await fetch(`http://localhost:${TEST_PORT}/api/businesses/unknown-non-existent-slug`);
    assert.equal(res404.status, 404);
    const data404 = await res404.json();
    assert.equal(data404.success, false);
    console.log('  ✓ Unknown slug correctly returns HTTP 404');

    // 10. Test SPA dynamic route serving
    for (const testSlug of ['demo-waffle-shop', 'royal-cafe', 'fresh-mart', 'burger-fam']) {
      const resRoute = await fetch(`http://localhost:${TEST_PORT}/r/${testSlug}`);
      assert.equal(resRoute.status, 200);
      const html = await resRoute.text();
      assert(html.includes('<div id="root"></div>'));
    }
    console.log('  ✓ All /r/:businessSlug SPA routes serve valid HTML');

    // 7. Test POST /api/generate-review
    console.log('Testing POST /api/generate-review...');
    const resGen = await fetch(`http://localhost:${TEST_PORT}/api/generate-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: 'Royal Cafe', rating: 5 })
    });
    assert.equal(resGen.status, 200);
    const dataGen = await resGen.json();
    assert.equal(dataGen.success, true);
    assert(typeof dataGen.review === 'string');
    assert(dataGen.review.length > 10);
    assert(dataGen.review.includes('Royal Cafe'));
    console.log('  ✓ POST /api/generate-review generated valid 5-star review:', dataGen.review);

    const resGenInvalid = await fetch(`http://localhost:${TEST_PORT}/api/generate-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: 'Royal Cafe', rating: 0 })
    });
    assert.equal(resGenInvalid.status, 400);
    console.log('  ✓ POST /api/generate-review rejected invalid rating');

    console.log('\n🎉 ALL MULTI-BUSINESS INTEGRATION TESTS PASSED!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      await deleteBusinessBySlug('burger-fam');
      await closeDb();
    } catch (_) {}
    server.close();
  }
});
