import puppeteer from 'puppeteer-core';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from '../server/routes/api.js';
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
  console.log(`🌐 Server running for Business + QR Creation E2E tests at http://localhost:${PORT}`);
  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });

    // Open Developer Page /
    console.log('\nNavigating to Developer Page /...');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

    // Step 1: Create "Royal Cafe"
    console.log('Step 1: Entering business name "Royal Cafe"...');
    await page.waitForSelector('#business-name');
    await page.type('#business-name', 'Royal Cafe');

    // Step 2: Enter placeholder Google review URL
    const testGoogleUrl = 'https://search.google.com/local/writereview?placeid=ROYAL_CAFE_PLACEHOLDER_789';
    console.log(`Step 2: Entering placeholder Google review URL: ${testGoogleUrl}`);
    await page.type('#google-review-url', testGoogleUrl);

    // Step 3: Generate the QR
    console.log('Step 3: Clicking "Generate QR" button...');
    await page.click('.btn-generate-qr');
    await page.waitForSelector('#qr-result-section', { timeout: 3000 });

    // Step 4: Verify the QR contains /r/royal-cafe
    console.log('Step 4: Verifying QR code value and customer URL...');
    const resultBizName = await page.$eval('.result-business-name', el => el.textContent.trim());
    assert.equal(resultBizName, 'Royal Cafe');

    const customerUrlText = await page.$eval('.customer-url-link', el => el.textContent.trim());
    const expectedCustomerUrl = `http://localhost:${PORT}/r/royal-cafe`;
    assert.equal(customerUrlText, expectedCustomerUrl);

    const qrDataValue = await page.$eval('.qr-canvas-holder', el => el.getAttribute('data-qr-value'));
    assert.equal(qrDataValue, expectedCustomerUrl);
    assert(qrDataValue.includes('/r/royal-cafe'));
    assert(!qrDataValue.includes('google.com'), 'QR must NOT encode Google review URL directly');

    // Verify canvas rendered
    const qrCanvas = await page.$('#business-qr-canvas');
    assert(qrCanvas !== null, 'QR canvas element must exist');
    console.log(`  ✓ QR code correctly encodes customer URL: ${qrDataValue}`);

    // Step 5: Open /r/royal-cafe
    console.log('\nStep 5: Opening /r/royal-cafe in the browser...');
    await page.goto(`http://localhost:${PORT}/r/royal-cafe`, { waitUntil: 'networkidle0' });

    // Step 6: Verify the customer page says "Royal Cafe"
    console.log('Step 6: Verifying customer page displays "Royal Cafe"...');
    const customerPageTitle = await page.$eval('.shop-name', el => el.textContent.trim());
    assert.equal(customerPageTitle, 'Royal Cafe');

    const customerPrompt = await page.$eval('.rating-prompt', el => el.textContent.trim());
    assert(customerPrompt.includes('How was your experience at Royal Cafe?'));
    console.log('  ✓ Customer page verified for "Royal Cafe":', customerPrompt);

    // Step 7: Verify its Google button uses Royal Cafe's configured Google review URL
    console.log('Step 7: Verifying configured Google review URL triggers on review submit...');
    // Intercept window.open
    await page.evaluate(() => {
      window.__openedUrls = [];
      window.open = (url) => {
        window.__openedUrls.push(url);
      };
    });

    // Tap 5 stars to reveal Copy & Leave Review button
    const stars = await page.$$('.star-button');
    await stars[4].click();
    await page.waitForSelector('.btn-primary-review', { timeout: 3000 });

    // Click "Copy & Leave Review →"
    const submitReviewBtn = await page.$('.btn-primary-review');
    await submitReviewBtn.click();
    await new Promise(r => setTimeout(r, 200));

    const openedUrls = await page.evaluate(() => window.__openedUrls);
    assert.equal(openedUrls.length, 1);
    assert.equal(openedUrls[0], testGoogleUrl);
    console.log(`  ✓ Google review button launched configured URL: ${openedUrls[0]}`);

    // Step 8: Refresh the developer page and verify the created business still exists
    console.log('\nStep 8: Refreshing developer page / to verify localStorage persistence...');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

    await page.waitForSelector('#qr-result-section', { timeout: 3000 });
    const refreshedBizName = await page.$eval('.result-business-name', el => el.textContent.trim());
    assert.equal(refreshedBizName, 'Royal Cafe', 'Created business should persist across refresh');

    const refreshedCustomerUrl = await page.$eval('.customer-url-link', el => el.textContent.trim());
    assert.equal(refreshedCustomerUrl, expectedCustomerUrl);
    console.log('  ✓ Created business successfully persisted across page refresh in localStorage');

    // Step 9: Test Download QR
    console.log('\nStep 9: Testing "Download QR" functionality...');
    // Spy on dynamic link click
    const downloadData = await page.evaluate(() => {
      const canvas = document.getElementById('business-qr-canvas');
      if (!canvas) return null;
      return {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
      };
    });
    assert(downloadData !== null, 'Canvas data should be readable');
    assert(downloadData.dataUrl.startsWith('data:image/png;base64,'), 'Should generate PNG data URL');
    assert(downloadData.width > 0 && downloadData.height > 0, 'Canvas dimensions must be non-zero');

    const downloadBtn = await page.$('.btn-download-qr');
    assert(downloadBtn !== null, 'Download QR button must exist');
    await downloadBtn.click();
    console.log(`  ✓ Download QR validated: generated PNG data with dimensions ${downloadData.width}x${downloadData.height}`);

    // Step 10: Test Copy URL
    console.log('\nStep 10: Testing "Copy URL" functionality...');
    const copyUrlBtn = await page.$('.btn-copy-url');
    assert(copyUrlBtn !== null, 'Copy URL button must exist');

    await copyUrlBtn.click();
    await new Promise(r => setTimeout(r, 200));

    const copyBtnText = await page.evaluate(el => el.textContent.trim(), copyUrlBtn);
    assert(copyBtnText.includes('Copied ✓'), `Button text should be 'Copied ✓', got: ${copyBtnText}`);
    console.log('  ✓ Copy URL button transitions to "Copied ✓" state');

    console.log('\n🎉 ALL 10 USER TEST REQUIREMENTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ E2E Test Failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
