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

const PORT = 5100;
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const server = app.listen(PORT, async () => {
  console.log(`🌐 Server running for E2E tests at http://localhost:${PORT}`);
  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Simulate mobile viewport (iPhone 14 / modern Android)
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // 1. Visit Dev Portal
    console.log('\nStep 1: Testing Developer Portal (QR view)...');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    const devTitle = await page.$eval('h1', el => el.textContent);
    assert(devTitle.includes('QR Review App Developer Portal'));
    const qrSvg = await page.$('svg');
    assert(qrSvg !== null, 'QR Code SVG should be rendered');
    console.log('  ✓ Developer Portal renders with QR code');

    // 2. Visit Customer Flow: /r/demo-waffle-shop
    console.log('\nStep 2: Testing Customer Landing Page (/r/demo-waffle-shop)...');
    await page.goto(`http://localhost:${PORT}/r/demo-waffle-shop`, { waitUntil: 'networkidle0' });

    // Check heading
    const shopHeading = await page.$eval('.shop-name', el => el.textContent);
    assert.equal(shopHeading, 'Demo Waffle Shop');
    const ratingPrompt = await page.$eval('.rating-prompt', el => el.textContent);
    assert(ratingPrompt.includes('How was your experience at Demo Waffle Shop?'));

    // Check 5 stars present
    const starButtons = await page.$$('.star-button');
    assert.equal(starButtons.length, 5, 'Should have 5 star buttons');
    console.log('  ✓ 5 empty stars and prompt displayed cleanly on mobile');

    // Experience section should not be visible before rating
    const experienceBefore = await page.$('.experience-container');
    assert.equal(experienceBefore, null, 'Experience section should not be visible initially');

    // 3. Select 5 Stars
    console.log('\nStep 3: Tapping 5 stars...');
    await starButtons[4].click();
    await new Promise(r => setTimeout(r, 300));

    // Check stars filled
    const filledStars = await page.$$('.star-button.filled');
    assert.equal(filledStars.length, 5, 'All 5 stars should be filled');
    const caption = await page.$eval('.rating-caption', el => el.textContent);
    assert(caption.includes('Loved it'));
    console.log('  ✓ Stars visually highlighted and caption updated');

    // 4. Verify Experience Selection appears
    console.log('\nStep 4: Checking Experience Selection...');
    await page.waitForSelector('.experience-container', { timeout: 3000 });
    const expTitle = await page.$eval('.section-title', el => el.textContent);
    assert.equal(expTitle, 'What did you like?');

    // Check pills
    const pills = await page.$$('.pill-button');
    assert.equal(pills.length, 5, 'Food, Service, Ambience, Price, Cleanliness pills should be present');

    // Select "Food" (index 0) and "Service" (index 1)
    await pills[0].click();
    await pills[1].click();
    await new Promise(r => setTimeout(r, 200));

    // Type optional specific note
    const textarea = await page.$('#specific-enjoyed-input');
    await textarea.type('Loved the chocolate waffle and friendly service');
    await new Promise(r => setTimeout(r, 300));
    console.log('  ✓ Selected Food & Service and typed specific note');

    // 5. Verify Review Draft Generation
    console.log('\nStep 5: Verifying Generated Review Draft...');
    await page.waitForSelector('.review-draft-container', { timeout: 3000 });
    const draftTitle = await page.$eval('.review-draft-container .section-title', el => el.textContent);
    assert.equal(draftTitle, 'Your review draft');

    const reviewDraftText = await page.$eval('.draft-textarea', el => el.value);
    console.log('  Generated draft text:', JSON.stringify(reviewDraftText));

    const expectedText = 'Really enjoyed my experience at Demo Waffle Shop. The food and service were great. Loved the chocolate waffle and friendly service.';
    assert.equal(reviewDraftText, expectedText);
    console.log('  ✓ Review draft matches exact factual template without hallucination');

    // 6. Test Copy Review button
    console.log('\nStep 6: Testing Copy Review button...');
    const copyBtn = await page.$('.btn-copy');
    const initialCopyBtnText = await page.evaluate(el => el.textContent, copyBtn);
    assert(initialCopyBtnText.includes('Copy Review'));

    await copyBtn.click();
    await new Promise(r => setTimeout(r, 200));

    const copiedBtnText = await page.evaluate(el => el.textContent, copyBtn);
    assert(copiedBtnText.includes('Copied ✓'), `Button text should be 'Copied ✓', got: ${copiedBtnText}`);
    console.log('  ✓ Button changed to "Copied ✓" on click');

    // 7. Test Google Review Button
    console.log('\nStep 7: Verifying Google Review Button...');
    const googleBtn = await page.$('.btn-google');
    const googleBtnText = await page.evaluate(el => el.textContent, googleBtn);
    assert(googleBtnText.includes('Leave Google Review'));
    console.log('  ✓ Google Review Button is present and prominent');

    console.log('\n🎊 ALL E2E MOBILE USER FLOW TESTS PASSED!\n');
  } catch (err) {
    console.error('❌ E2E Test Failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
