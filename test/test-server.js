import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from '../server/routes/api.js';

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

    // 6. Test SPA dynamic route serving
    for (const testSlug of ['demo-waffle-shop', 'royal-cafe', 'fresh-mart']) {
      const resRoute = await fetch(`http://localhost:${TEST_PORT}/r/${testSlug}`);
      assert.equal(resRoute.status, 200);
      const html = await resRoute.text();
      assert(html.includes('<div id="root"></div>'));
    }
    console.log('  ✓ All /r/:businessSlug SPA routes serve valid HTML');

    console.log('\n🎉 ALL MULTI-BUSINESS INTEGRATION TESTS PASSED!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
