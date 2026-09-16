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

    // Step 2: Test /r/demo-waffle-shop with single "Copy & Leave Review →" CTA
    console.log('\nStep 2: Testing /r/demo-waffle-shop unified CTA flow...');
    await page.goto(`http://localhost:${PORT}/r/demo-waffle-shop`, { waitUntil: 'networkidle0' });

    // Spy on window.open
    await page.evaluate(() => {
      window.__openedUrls = [];
      window.open = (url) => {
        window.__openedUrls.push(url);
      };
    });

    const waffleShopName = await page.$eval('.shop-name', el => el.textContent);
    assert.equal(waffleShopName, 'Demo Waffle Shop');
    const wafflePrompt = await page.$eval('.rating-prompt', el => el.textContent);
    assert(wafflePrompt.includes('How was your experience at Demo Waffle Shop?'));
    console.log('  ✓ Demo Waffle Shop prompt matches:', wafflePrompt.trim());

    // Tap 5 stars to reveal review section
    const waffleStars = await page.$$('.star-button');
    await waffleStars[4].click();
    await page.waitForSelector('.btn-primary-review', { timeout: 3000 });

    // Verify removal of legacy buttons & 3-step box
    const oldCopyBtn = await page.$('.btn-copy');
    const oldGoogleBtn = await page.$('.btn-google');
    const oldFlowHint = await page.$('.flow-hint');
    assert.equal(oldCopyBtn, null, 'Separate Copy Review button must be removed');
    assert.equal(oldGoogleBtn, null, 'Separate Leave Google Review button must be removed');
    assert.equal(oldFlowHint, null, 'Legacy 3-step instructional box must be removed');
    console.log('  ✓ Separate buttons and 3-step box are removed');

    // Verify single primary button exists
    const primaryBtn = await page.$('.btn-primary-review');
    assert(primaryBtn !== null, 'Unified "Copy & Leave Review →" button must exist');
    const btnText = await page.evaluate(el => el.textContent, primaryBtn);
    assert(btnText.includes('Copy & Leave Review'), `Button text should include 'Copy & Leave Review', got: ${btnText}`);
    console.log('  ✓ Single primary button "Copy & Leave Review →" verified');

    // Verify subtle helper text below button
    const helperText = await page.$eval('.subtle-helper-text', el => el.textContent);
    assert.equal(helperText.trim(), 'Your review has been copied. Paste it on Google and submit your rating.');
    console.log('  ✓ Subtle helper text verified:', helperText.trim());

    // Verify textarea is editable before clicking
    const textarea = await page.$('.draft-textarea');
    await textarea.focus();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await textarea.type('Custom edit: Outstanding liege waffles!');
    const editedValue = await page.$eval('.draft-textarea', el => el.value);
    assert.equal(editedValue, 'Custom edit: Outstanding liege waffles!');
    console.log('  ✓ Review textarea is fully editable before button click');

    // Click "Copy & Leave Review →"
    await primaryBtn.click();
    await new Promise(r => setTimeout(r, 300));

    // Verify button state changes to copied
    const updatedBtnText = await page.evaluate(el => el.textContent, primaryBtn);
    assert(updatedBtnText.includes('Copied'), `Button text should show copied status, got: ${updatedBtnText}`);

    // Verify window.open was called with configured Google review URL
    const openedUrls = await page.evaluate(() => window.__openedUrls);
    assert.equal(openedUrls.length, 1, 'window.open should have been called once');
    assert(openedUrls[0].includes('search.google.com'), `Should open Google review URL, got: ${openedUrls[0]}`);
    console.log('  ✓ Single click copied review and triggered Google URL open:', openedUrls[0]);

    // Step 3: Test /r/royal-cafe
    console.log('\nStep 3: Testing /r/royal-cafe with unified CTA...');
    await page.goto(`http://localhost:${PORT}/r/royal-cafe`, { waitUntil: 'networkidle0' });

    await page.evaluate(() => {
      window.__openedUrls = [];
      window.open = (url) => {
        window.__openedUrls.push(url);
      };
    });

    const cafeShopName = await page.$eval('.shop-name', el => el.textContent);
    assert.equal(cafeShopName, 'Royal Cafe');
    const cafePrompt = await page.$eval('.rating-prompt', el => el.textContent);
    assert(cafePrompt.includes('How was your experience at Royal Cafe?'));

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

    const cafePrimaryBtn = await page.$('.btn-primary-review');
    await cafePrimaryBtn.click();
    await new Promise(r => setTimeout(r, 200));

    const cafeOpenedUrls = await page.evaluate(() => window.__openedUrls);
    assert.equal(cafeOpenedUrls.length, 1);
    assert(cafeOpenedUrls[0].includes('search.google.com'));
    console.log('  ✓ Royal Cafe unified CTA executed smoothly');

    // Step 4: Test /r/fresh-mart
    console.log('\nStep 4: Testing /r/fresh-mart with unified CTA...');
    await page.goto(`http://localhost:${PORT}/r/fresh-mart`, { waitUntil: 'networkidle0' });

    const martShopName = await page.$eval('.shop-name', el => el.textContent);
    assert.equal(martShopName, 'Fresh Mart');
    const martPrompt = await page.$eval('.rating-prompt', el => el.textContent);
    assert(martPrompt.includes('How was your experience at Fresh Mart?'));
    console.log('  ✓ Fresh Mart loaded successfully with dynamic prompt');

    console.log('\n🎊 ALL E2E TESTS WITH UNIFIED CTA PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Multi-business E2E test failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
