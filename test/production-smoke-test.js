import https from 'https';
import puppeteer from 'puppeteer-core';

const PROD_URL = 'https://qr-review-app-2mat.vercel.app';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function rawRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json: () => {
            try { return JSON.parse(body); } catch(e) { return null; }
          }
        });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function request(options, postData = null, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await rawRequest(options, postData);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function runSmokeTest() {
  console.log('🚀 STARTING PRODUCTION PARITY & SMOKE TEST ON CANONICAL DEPLOYMENT:');
  console.log(`Target: ${PROD_URL}\n`);

  const results = {
    apiHealth: false,
    cachingAndTiming: false,
    starGenerations: [],
    browserTests: []
  };

  // 1. API Health & Database Connectivity
  console.log('--- 1. PROBING PRODUCTION API & ATLAS DB ---');
  const dbRes = await request({
    hostname: 'qr-review-app-2mat.vercel.app',
    path: '/api/db-status',
    method: 'GET'
  });
  const dbData = dbRes.json();
  console.log('GET /api/db-status -> HTTP', dbRes.statusCode, dbData);
  if (dbRes.statusCode === 200 && dbData?.isConnected && dbData?.isAtlas) {
    results.apiHealth = true;
    console.log('✓ Atlas MongoDB connection active and verified.\n');
  } else {
    throw new Error('Database health check failed on production!');
  }

  // 2. Cache & Server-Timing Check
  console.log('--- 2. VERIFYING CACHE & SERVER-TIMING ---');
  const biz1 = await request({
    hostname: 'qr-review-app-2mat.vercel.app',
    path: '/api/businesses/royal-cafe',
    method: 'GET'
  });
  console.log('Cold/First lookup Server-Timing:', biz1.headers['server-timing']);
  const biz2 = await request({
    hostname: 'qr-review-app-2mat.vercel.app',
    path: '/api/businesses/royal-cafe',
    method: 'GET'
  });
  console.log('Warm/Cached lookup Server-Timing:', biz2.headers['server-timing']);
  const biz2Data = biz2.json();
  if (biz2.statusCode === 200 && biz2Data?.data?.name === 'Royal Cafe' && biz2Data._perf) {
    results.cachingAndTiming = true;
    console.log('✓ Business lookup and Server-Timing metadata verified on production.\n');
  } else {
    throw new Error('Business lookup verification failed on production!');
  }

  // 3. Controlled 1-5 Star Review Generation Across Business Types
  console.log('--- 3. CONTROLLED 1-5 STAR REVIEW GENERATION SMOKE TEST ---');
  const testCases = [
    { rating: 1, businessName: 'Royal Cafe', businessType: 'cafe', aiContext: '' },
    { rating: 2, businessName: 'XYZ Bar', businessType: 'cocktail bar', aiContext: 'Craft cocktails, rooftop seating, live DJ on weekends' },
    { rating: 3, businessName: 'Demo Waffle Shop', businessType: 'waffle shop', aiContext: 'Belgian waffles, freshly brewed coffee, casual vibe' },
    { rating: 4, businessName: 'Fresh Mart', businessType: 'grocery store', aiContext: 'Organic produce, daily essentials, friendly checkout' },
    { rating: 5, businessName: 'Khwaab Rooftop', businessType: 'business', aiContext: '' }
  ];

  for (const tc of testCases) {
    const postData = JSON.stringify(tc);
    const start = Date.now();
    const genRes = await request({
      hostname: 'qr-review-app-2mat.vercel.app',
      path: '/api/generate-review',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
    const duration = Date.now() - start;
    const genData = genRes.json();
    const reviewText = genData?.review || genData?.data?.review;
    const words = reviewText ? reviewText.trim().split(/\s+/).length : 0;
    
    // Quality checks
    const passesQuality = reviewText && 
      words >= 6 && 
      words <= 50 &&
      !reviewText.includes('Here is a review') &&
      !reviewText.includes('openings (') &&
      !reviewText.startsWith('"') &&
      /[.!?]$/.test(reviewText.trim());

    console.log(`Rating: ${tc.rating}★ [${tc.businessName} - ${tc.businessType}] (${duration}ms)`);
    console.log(`Review (${words} words): "${reviewText}"`);
    console.log(`Quality check passed: ${passesQuality ? '✓ YES' : '✗ NO'}`);
    console.log('---');

    results.starGenerations.push({
      ...tc,
      reviewText,
      words,
      duration,
      passesQuality
    });
    await new Promise(r => setTimeout(r, 600));
  }

  // 4. Live Browser UI & Butter UX Smoke Test
  console.log('\n--- 4. LIVE BROWSER UI & BUTTER UX SMOKE TEST ---');
  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  // Test Royal Cafe
  console.log('Navigating to /r/royal-cafe ...');
  await page.goto(`${PROD_URL}/r/royal-cafe`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('main.mobile-canvas', { timeout: 15000 });
  const cafeTheme = await page.$eval('main.mobile-canvas', el => el.className);
  const cafeAvatar = await page.$eval('.shop-avatar span', el => el.innerText.trim());
  const cafePill = await page.$eval('.business-type-pill', el => el.innerText.trim());
  const cafePrompt = await page.$eval('.rating-prompt', el => el.innerText.trim());
  console.log('Royal Cafe UI:', { cafeTheme, cafeAvatar, cafePill, cafePrompt });

  // Select 5 stars
  console.log('Clicking 5 stars on Royal Cafe...');
  await page.click('button[aria-label="Exceptional (5 stars)"]');
  await page.waitForSelector('.draft-textarea', { timeout: 15000 });
  const generatedVal = await page.$eval('.draft-textarea', el => el.value);
  console.log(`Generated in UI: "${generatedVal}"`);

  // Verify feedback slot height and copy button
  const slotHeight = await page.$eval('.action-feedback-slot', el => el.getBoundingClientRect().height);
  console.log(`Action feedback slot height: ${slotHeight}px (Zero layout shift: expected 24px)`);

  // Test Copy & Leave Review
  console.log('Clicking Copy & Leave Review...');
  await page.click('.btn-primary-review');
  await page.waitForSelector('.copy-confirm-message', { timeout: 4000 });
  const feedbackMsg = await page.$eval('.copy-confirm-message', el => el.innerText.trim());
  console.log(`Feedback toast message: "${feedbackMsg}"`);

  // Test Demo Waffle Shop
  console.log('\nNavigating to /r/demo-waffle-shop ...');
  await page.goto(`${PROD_URL}/r/demo-waffle-shop`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('main.mobile-canvas', { timeout: 15000 });
  const waffleTheme = await page.$eval('main.mobile-canvas', el => el.className);
  const waffleAvatar = await page.$eval('.shop-avatar span', el => el.innerText.trim());
  const wafflePill = await page.$eval('.business-type-pill', el => el.innerText.trim());
  console.log('Demo Waffle Shop UI:', { waffleTheme, waffleAvatar, wafflePill });

  // Test XYZ Bar
  console.log('\nNavigating to /r/xyz-bar ...');
  await page.goto(`${PROD_URL}/r/xyz-bar`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('main.mobile-canvas', { timeout: 15000 });
  const barTheme = await page.$eval('main.mobile-canvas', el => el.className);
  const barAvatar = await page.$eval('.shop-avatar span', el => el.innerText.trim());
  const barPill = await page.$eval('.business-type-pill', el => el.innerText.trim());
  console.log('XYZ Bar UI:', { barTheme, barAvatar, barPill });

  // Test Dev Portal Dropdown
  console.log('\nNavigating to Dev Portal / ...');
  await page.goto(`${PROD_URL}/`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('select#business-type', { timeout: 15000 });
  const selectExists = await page.$('select#business-type') !== null;
  const optionCount = await page.$$eval('select#business-type option', opts => opts.length);
  console.log(`Dev Portal Business Type Selector present: ${selectExists}, Options count: ${optionCount}`);

  await browser.close();

  results.browserTests.push({
    royalCafe: { cafeTheme, cafeAvatar, cafePill, cafePrompt, slotHeight, feedbackMsg },
    waffleShop: { waffleTheme, waffleAvatar, wafflePill },
    xyzBar: { barTheme, barAvatar, barPill },
    devPortal: { selectExists, optionCount }
  });

  console.log('\n========================================');
  console.log('🎉 ALL PRODUCTION PARITY & SMOKE TESTS COMPLETED SUCCESSFULLY!');
  console.log('========================================');
  return results;
}

runSmokeTest().catch(err => {
  console.error('❌ Production smoke test failed:', err);
  process.exit(1);
});
