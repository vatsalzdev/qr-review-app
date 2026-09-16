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

// Express 5 compatible client fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const TEST_PORT = 5099;

const server = app.listen(TEST_PORT, async () => {
  console.log(`📡 Test Server running on port ${TEST_PORT}`);

  try {
    // 1. Test GET /api/businesses
    console.log('Testing GET /api/businesses...');
    const resList = await fetch(`http://localhost:${TEST_PORT}/api/businesses`);
    assert.equal(resList.status, 200);
    const dataList = await resList.json();
    assert.equal(dataList.success, true);
    assert(Array.isArray(dataList.data));
    assert.equal(dataList.data[0].slug, 'demo-waffle-shop');
    console.log('  ✓ GET /api/businesses returned 200 with businesses list');

    // 2. Test GET /api/businesses/demo-waffle-shop
    console.log('Testing GET /api/businesses/demo-waffle-shop...');
    const resBiz = await fetch(`http://localhost:${TEST_PORT}/api/businesses/demo-waffle-shop`);
    assert.equal(resBiz.status, 200);
    const dataBiz = await resBiz.json();
    assert.equal(dataBiz.success, true);
    assert.equal(dataBiz.data.name, 'Demo Waffle Shop');
    assert.equal(dataBiz.data.slug, 'demo-waffle-shop');
    assert(dataBiz.data.googleReviewUrl.length > 0);
    console.log('  ✓ GET /api/businesses/demo-waffle-shop returned correct business');

    // 3. Test 404 for unknown business
    console.log('Testing GET /api/businesses/unknown-shop (404 check)...');
    const res404 = await fetch(`http://localhost:${TEST_PORT}/api/businesses/unknown-shop`);
    assert.equal(res404.status, 404);
    console.log('  ✓ Correctly returned 404 for unknown slug');

    // 4. Test PATCH /api/businesses/demo-waffle-shop
    console.log('Testing PATCH /api/businesses/demo-waffle-shop...');
    const newGoogleUrl = 'https://search.google.com/local/writereview?placeid=TEST_PLACE_ID';
    const resPatch = await fetch(`http://localhost:${TEST_PORT}/api/businesses/demo-waffle-shop`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleReviewUrl: newGoogleUrl })
    });
    assert.equal(resPatch.status, 200);
    const dataPatch = await resPatch.json();
    assert.equal(dataPatch.data.googleReviewUrl, newGoogleUrl);
    console.log('  ✓ Configurable Google review URL updated successfully');

    // 5. Test Frontend HTML serving for /r/demo-waffle-shop
    console.log('Testing client serving on /r/demo-waffle-shop...');
    const resHtml = await fetch(`http://localhost:${TEST_PORT}/r/demo-waffle-shop`);
    assert.equal(resHtml.status, 200);
    const htmlText = await resHtml.text();
    assert(htmlText.includes('<div id="root"></div>'), 'HTML should contain root div');
    assert(htmlText.includes('Customer Review - Demo Waffle Shop'), 'HTML title should match');
    console.log('  ✓ Frontend SPA successfully served for /r/demo-waffle-shop route');

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED!\n');
  } catch (err) {
    console.error('❌ Integration test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
