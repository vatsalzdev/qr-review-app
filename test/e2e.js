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

const PORT = 5101;
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const server = app.listen(PORT, async () => {
  console.log(`🌐 Server running for Multi-Business E2E tests at http://localhost:${PORT}`);
  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // Step 1: Check Developer Portal displays all businesses & QR codes
    console.log('\nStep 1: Testing Developer Portal with Multiple Businesses...');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

    const waffleCard = await page.$('#card-demo-waffle-shop');
    const cafeCard = await page.$('#card-royal-cafe');
    const martCard = await page.$('#card-fresh-mart');

    assert(waffleCard !== null, 'Demo Waffle Shop card should exist');
    assert(cafeCard !== null, 'Royal Cafe card should exist');
    assert(martCard !== null, 'Fresh Mart card should exist');

    const qrSvgs = await page.$$('.qr-box svg');
    assert(qrSvgs.length >= 3, 'Should render at least 3 QR codes');
    console.log(`  ✓ Developer Portal rendered ${qrSvgs.length} QR codes for configured businesses`);

    // Step 2: Test /r/demo-waffle-shop
    console.log('\nStep 2: Testing /r/demo-waffle-shop...');
    await page.goto(`http://localhost:${PORT}/r/demo-waffle-shop`, { waitUntil: 'networkidle0' });

    const waffleShopName = await page.$eval('.shop-name', el => el.textContent);
    assert.equal(waffleShopName, 'Demo Waffle Shop');
    const wafflePrompt = await page.$eval('.rating-prompt', el => el.textContent);
    assert(wafflePrompt.includes('How was your experience at Demo Waffle Shop?'));
    console.log('  ✓ Demo Waffle Shop prompt matches:', wafflePrompt.trim());

    // Tap 5 stars to reveal Google button and verify URL
    const waffleStars = await page.$$('.star-button');
    await waffleStars[4].click();
    await page.waitForSelector('.btn-google', { timeout: 3000 });
    console.log('  ✓ Demo Waffle Shop interactive flow works');

    // Step 3: Test /r/royal-cafe
    console.log('\nStep 3: Testing /r/royal-cafe...');
    await page.goto(`http://localhost:${PORT}/r/royal-cafe`, { waitUntil: 'networkidle0' });

    const cafeShopName = await page.$eval('.shop-name', el => el.textContent);
    assert.equal(cafeShopName, 'Royal Cafe');
    const cafeType = await page.$eval('.business-type-pill', el => el.textContent);
    assert.equal(cafeType, 'cafe');
    const cafePrompt = await page.$eval('.rating-prompt', el => el.textContent);
    assert(cafePrompt.includes('How was your experience at Royal Cafe?'));
    console.log('  ✓ Royal Cafe prompt matches:', cafePrompt.trim());

    // Tap 4 stars
    const cafeStars = await page.$$('.star-button');
    await cafeStars[3].click();
    await page.waitForSelector('.experience-container', { timeout: 3000 });

    // Select Food pill
    const cafePills = await page.$$('.pill-button');
    await cafePills[0].click(); // Food
    await new Promise(r => setTimeout(r, 200));

    const cafeReviewText = await page.$eval('.draft-textarea', el => el.value);
    assert.equal(cafeReviewText, 'Had a really good experience at Royal Cafe. I especially enjoyed the food.');
    console.log('  ✓ Royal Cafe generated review draft:', cafeReviewText);

    // Test Copy button
    const copyBtn = await page.$('.btn-copy');
    await copyBtn.click();
    await new Promise(r => setTimeout(r, 200));
    const copiedText = await page.evaluate(el => el.textContent, copyBtn);
    assert(copiedText.includes('Copied ✓'));
    console.log('  ✓ Copy button transitions to "Copied ✓"');

    // Step 4: Test /r/fresh-mart
    console.log('\nStep 4: Testing /r/fresh-mart...');
    await page.goto(`http://localhost:${PORT}/r/fresh-mart`, { waitUntil: 'networkidle0' });

    const martShopName = await page.$eval('.shop-name', el => el.textContent);
    assert.equal(martShopName, 'Fresh Mart');
    const martType = await page.$eval('.business-type-pill', el => el.textContent);
    assert.equal(martType, 'grocery store');
    const martPrompt = await page.$eval('.rating-prompt', el => el.textContent);
    assert(martPrompt.includes('How was your experience at Fresh Mart?'));
    console.log('  ✓ Fresh Mart prompt matches:', martPrompt.trim());

    // Step 5: Test unknown slug error page
    console.log('\nStep 5: Testing unknown slug /r/non-existent-shop...');
    await page.goto(`http://localhost:${PORT}/r/non-existent-shop`, { waitUntil: 'networkidle0' });
    const notFoundText = await page.$eval('.error-page h2', el => el.textContent);
    assert.equal(notFoundText, 'Business Not Found');
    console.log('  ✓ Gracefully handled unknown business slug');

    console.log('\n🎊 ALL MULTI-BUSINESS E2E TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Multi-business E2E test failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
