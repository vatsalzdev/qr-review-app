import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from '../server/routes/api.js';
import { initDb, getBusinessBySlug, deleteBusinessBySlug, closeDb } from '../server/db/mongo.js';
import assert from 'node:assert/strict';

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

const PORT = 5102;
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const server = app.listen(PORT, async () => {
  console.log(`🌐 Server running for Stage 1 E2E tests at http://localhost:${PORT}`);
  let browser;

  try {
    // Initialize MongoDB Atlas connection
    await initDb();

    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });

    // Step 1 & 2: Open Dev Portal
    console.log('\n[1-2] Navigating to Developer Page / ...');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

    // Step 3: Create "Burger Fam" through actual Dev Portal UI
    console.log('[3] Creating "Burger Fam" through the actual UI...');
    await page.waitForSelector('#business-name');
    await page.type('#business-name', 'Burger Fam');

    const testGoogleUrl = 'https://search.google.com/local/writereview?placeid=BURGER_FAM_E2E_123';
    console.log(`    Entering Google review URL: ${testGoogleUrl}`);
    await page.type('#google-review-url', testGoogleUrl);

    // Step 4: Submit form (triggers POST /api/businesses)
    console.log('[4] Clicking "Generate QR" to submit business creation to backend/MongoDB...');
    await page.click('.btn-generate-qr');
    await page.waitForSelector('#qr-result-section', { timeout: 5000 });
    console.log('  ✓ POST /api/businesses succeeded and QR result section rendered');

    // Step 5: Verify business is persisted in MongoDB Atlas
    console.log('[5] Verifying "Burger Fam" is persisted in MongoDB Atlas...');
    const atlasDoc = await getBusinessBySlug('burger-fam');
    assert(atlasDoc !== null, 'Business "Burger Fam" not found in Atlas database');
    assert.equal(atlasDoc.name, 'Burger Fam');
    assert.equal(atlasDoc.slug, 'burger-fam');
    assert.equal(atlasDoc.status, 'active');
    assert.equal(atlasDoc.googleReviewUrl, testGoogleUrl);
    console.log('  ✓ Business confirmed directly in MongoDB Atlas with status: "active"');

    // Step 6: Verify Customer URL is strictly slug-only (NO ?name=, NO ?google=)
    console.log('[6] Verifying Customer URL is slug-only without query params...');
    const customerUrlText = await page.$eval('.customer-url-link', el => el.textContent.trim());
    const expectedCustomerUrl = `http://localhost:${PORT}/r/burger-fam`;
    assert.equal(customerUrlText, expectedCustomerUrl);
    assert(!customerUrlText.includes('?name='), 'Customer URL must not contain ?name=');
    assert(!customerUrlText.includes('?google='), 'Customer URL must not contain ?google=');
    console.log(`  ✓ Customer URL is clean slug: ${customerUrlText}`);

    // Step 7: Verify generated QR encodes that clean URL
    console.log('[7] Verifying generated QR canvas encodes clean slug URL...');
    const qrDataValue = await page.$eval('.qr-canvas-holder', el => el.getAttribute('data-qr-value'));
    assert.equal(qrDataValue, expectedCustomerUrl);
    assert(!qrDataValue.includes('?name='), 'QR must NOT contain ?name=');
    assert(!qrDataValue.includes('?google='), 'QR must NOT contain ?google=');
    console.log(`  ✓ QR data value correctly encodes: ${qrDataValue}`);

    // Step 8: Open customer URL in a fresh page context with no existing localStorage
    console.log('\n[8] Opening customer URL in fresh browser context with empty localStorage...');
    await page.goto(customerUrlText, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });

    // Step 9 & 10: Verify customer page retrieves Burger Fam from MongoDB and loads active flow
    console.log('[9-10] Verifying customer page retrieves "Burger Fam" and loads active flow...');
    const customerPageTitle = await page.$eval('.shop-name', el => el.textContent.trim());
    assert.equal(customerPageTitle, 'Burger Fam');

    const customerPrompt = await page.$eval('.rating-prompt', el => el.textContent.trim());
    assert(customerPrompt.includes('How was your experience at Burger Fam?'));
    console.log('  ✓ Customer page verified for "Burger Fam" directly from MongoDB');

    // Step 11: Select rating (5 stars)
    console.log('\n[11-12] Selecting 5 stars and verifying cinematic AI generation animation...');
    const stars = await page.$$('.star-button');
    await stars[4].click();

    // Step 12: Verify cinematic AI generation animation appears
    const genAnimation = await page.waitForSelector('.review-gen-animation-container', { timeout: 3000 });
    assert(genAnimation !== null, 'Cinematic AI animation container must appear');
    const streamViewport = await page.$('.card-stream-viewport');
    assert(streamViewport !== null, 'Horizontal card stream viewport must appear');
    console.log('  ✓ Cinematic AI card stream animation appeared');

    // Step 13 & 14: Wait for generated review to appear and verify it is editable
    console.log('[13-14] Verifying generated review appears and remains editable in textarea...');
    await page.waitForSelector('.draft-textarea', { timeout: 15000 });
    const originalReview = await page.$eval('.draft-textarea', el => el.value);
    assert(originalReview && originalReview.length > 5, 'Review draft must be generated');

    // Test editing review text
    await page.type('.draft-textarea', ' Adding customized feedback.');
    const updatedReview = await page.$eval('.draft-textarea', el => el.value);
    assert(updatedReview.includes('Adding customized feedback.'), 'Review text must be editable');
    console.log('  ✓ Review draft successfully generated and verified editable');

    // Step 15 & 16: Test Copy & Leave Review and 800ms Google navigation
    console.log('\n[15-16] Testing Copy & Leave Review button and 800ms Google redirect...');
    await page.evaluate(() => {
      window.__openedUrls = [];
      window.open = (url) => {
        window.__openedUrls.push(url);
      };
    });

    const submitReviewBtn = await page.$('.btn-primary-review');
    await submitReviewBtn.click();

    // Verify immediate UI transition to "✓ Review Copied!"
    const btnTextAfterClick = await page.$eval('.btn-primary-review', el => el.textContent.trim());
    assert(btnTextAfterClick.includes('Review Copied'), 'Button should switch to copied state');

    // Wait for the intentional 800ms navigation delay before Google URL opens
    await new Promise(r => setTimeout(r, 1000));
    const openedUrls = await page.evaluate(() => window.__openedUrls);
    assert.equal(openedUrls.length, 1);
    assert.equal(openedUrls[0], testGoogleUrl);
    console.log(`  ✓ Google review button launched configured URL after 800ms delay: ${openedUrls[0]}`);

    // Step 17: Suspend Burger Fam status via API
    console.log('\n[17] Updating "Burger Fam" status to "suspended" in database...');
    const suspendRes = await fetch(`http://localhost:${PORT}/api/businesses/burger-fam/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' })
    });
    assert.equal(suspendRes.status, 200);

    // Step 18-20: Open /r/burger-fam in fresh context and verify "Service Currently Unavailable"
    console.log('[18-20] Opening /r/burger-fam in fresh browser context while suspended...');
    await page.goto(`http://localhost:${PORT}/r/burger-fam`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });

    await page.waitForSelector('.suspended-page', { timeout: 4000 });
    const suspendedHeading = await page.$eval('.suspended-page h2', el => el.textContent.trim());
    assert.equal(suspendedHeading, 'Service Currently Unavailable');

    // Verify star rating and review flow are NOT accessible
    const starButtons = await page.$$('.star-button');
    assert.equal(starButtons.length, 0, 'Star buttons must not be rendered when suspended');
    console.log('  ✓ "Service Currently Unavailable" state rendered correctly; review flow blocked');

    // Step 21-22: Reactivate Burger Fam status to "active" and verify recovery
    console.log('\n[21-22] Reactivating "Burger Fam" to "active" status and verifying recovery...');
    const reactivateRes = await fetch(`http://localhost:${PORT}/api/businesses/burger-fam/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });
    assert.equal(reactivateRes.status, 200);

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.shop-header', { timeout: 4000 });
    const reactivatedTitle = await page.$eval('.shop-name', el => el.textContent.trim());
    assert.equal(reactivatedTitle, 'Burger Fam');
    const reactivatedStars = await page.$$('.star-button');
    assert.equal(reactivatedStars.length, 5, 'Star buttons must be restored when reactivated');
    console.log('  ✓ Active review flow restored successfully upon reactivation');

    console.log('\n🎉 ALL 22 STAGE 1 END-TO-END VERIFICATION STEPS PASSED!\n');
  } catch (err) {
    console.error('❌ E2E Test Failed:', err);
    process.exitCode = 1;
  } finally {
    // Clean up temporary test business from MongoDB Atlas
    try {
      console.log('🧹 Cleaning up temporary test business ("burger-fam") from Atlas...');
      await deleteBusinessBySlug('burger-fam');
      console.log('  ✓ Cleaned up "burger-fam" from Atlas');
      await closeDb();
    } catch (_) {}

    if (browser) await browser.close();
    server.close();
  }
});
