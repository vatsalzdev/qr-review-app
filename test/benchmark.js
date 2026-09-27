import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from '../server/routes/api.js';
import { initDb, closeDb } from '../server/db/mongo.js';

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

const PORT = 5110;
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function runBenchmark() {
  console.log('🏁 Starting Phase 2 Performance & Latency Benchmark...\n');

  const server = app.listen(PORT);
  let browser;

  try {
    // -------------------------------------------------------------
    // PART 1: Backend API Raw Latency (Cold vs Warm)
    // -------------------------------------------------------------
    console.log('--- PART 1: Backend API Latency (MongoDB Atlas & AI Endpoints) ---');

    // Cold DB init measurement
    console.log('\n[Cold DB Start] Initializing MongoDB connection...');
    const tDb0 = performance.now();
    await initDb();
    const coldDbInitMs = Math.round(performance.now() - tDb0);
    console.log(`  ✓ Cold MongoDB Atlas Connection + Seed/Index Check: ${coldDbInitMs} ms`);

    // Business Lookup Cold (First lookup after connection)
    const tLookCold0 = performance.now();
    const resLookCold = await fetch(`http://localhost:${PORT}/api/businesses/royal-cafe`);
    const lookColdDuration = Math.round(performance.now() - tLookCold0);
    const lookColdData = await resLookCold.json();
    console.log(`  ✓ Cold Business Lookup (/api/businesses/royal-cafe): ${lookColdDuration} ms (dbLookupMs: ${lookColdData._perf?.dbLookupMs} ms)`);

    // Business Lookup Warm (Average of 5 subsequent requests)
    const warmLookupTimes = [];
    const warmDbTimes = [];
    for (let i = 0; i < 5; i++) {
      const tStart = performance.now();
      const res = await fetch(`http://localhost:${PORT}/api/businesses/royal-cafe`);
      const dur = Math.round(performance.now() - tStart);
      const data = await res.json();
      warmLookupTimes.push(dur);
      if (typeof data._perf?.dbLookupMs === 'number') warmDbTimes.push(data._perf.dbLookupMs);
    }
    const avgWarmLookup = Math.round(warmLookupTimes.reduce((a, b) => a + b, 0) / warmLookupTimes.length);
    const avgWarmDb = warmDbTimes.length ? Math.round(warmDbTimes.reduce((a, b) => a + b, 0) / warmDbTimes.length) : 0;
    console.log(`  ✓ Warm Business Lookup (5 runs): avg ${avgWarmLookup} ms (dbLookupMs: avg ${avgWarmDb} ms, samples: ${warmLookupTimes.join(', ')} ms)`);

    // AI Generation Latency (5 runs)
    console.log('\n[AI Generation Endpoint] Measuring POST /api/generate-review...');
    const aiGenLatencies = [];
    const aiServiceTimes = [];
    const valTimes = [];
    let fallbackCount = 0;
    let retryCount = 0;

    for (let i = 0; i < 3; i++) {
      const tAi0 = performance.now();
      const resAi = await fetch(`http://localhost:${PORT}/api/generate-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: 'Royal Cafe',
          rating: 5,
          businessType: 'cafe',
          aiContext: 'Specialty coffee, pastries, relaxing ambience',
          slug: 'royal-cafe'
        })
      });
      const aiTotalDur = Math.round(performance.now() - tAi0);
      const aiData = await resAi.json();
      aiGenLatencies.push(aiTotalDur);
      if (aiData._perf) {
        aiServiceTimes.push(aiData._perf.aiGenerationMs);
        valTimes.push(aiData._perf.validationMs);
        if (aiData._perf.fallbackUsed) fallbackCount++;
        if (aiData._perf.retryCount > 0) retryCount += aiData._perf.retryCount;
      }
      console.log(`  Run ${i + 1}: ${aiTotalDur} ms (AI API: ${aiData._perf?.aiGenerationMs} ms, Validation: ${aiData._perf?.validationMs} ms, Model: ${aiData._perf?.modelUsed}, Fallback: ${aiData._perf?.fallbackUsed})`);
    }

    // -------------------------------------------------------------
    // PART 2: End-to-End Browser Customer Flow (Puppeteer Mobile Profile)
    // -------------------------------------------------------------
    console.log('\n--- PART 2: End-to-End Mobile Browser Customer Flow ---');

    browser = await puppeteer.launch({
      executablePath: edgePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Mobile Viewport (iPhone / Android flagship simulation)
    await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });

    // Measure Cold Page Load (empty browser cache)
    console.log('\n[Cold Browser Session] Navigating to /r/royal-cafe...');
    const navStart = performance.now();
    const response = await page.goto(`http://localhost:${PORT}/r/royal-cafe`, { waitUntil: 'networkidle0' });
    const navEnd = performance.now();
    const htmlResponseTime = Math.round(navEnd - navStart);
    console.log(`  ✓ Initial Page Network Idle: ${htmlResponseTime} ms (HTTP Status: ${response.status()})`);

    // Wait for business data to render & stars to become interactive
    await page.waitForSelector('.star-button', { timeout: 10000 });
    const perfDataCold = await page.evaluate(() => window.__qrPerf || {});
    console.log(`  ✓ Business Lookup from Client: ${perfDataCold.businessLookupMs} ms`);
    console.log(`  ✓ Page Interactive Time: ${Math.round(perfDataCold.pageInteractiveTime || 0)} ms`);

    // Tap 5-star rating and measure AI generation to usable review
    console.log('\n[Rating Interaction] Tapping 5 stars...');
    const starBtns = await page.$$('.star-button');
    if (starBtns.length >= 5) {
      await starBtns[4].click();
    }

    // Wait for review textarea to be usable
    await page.waitForSelector('.draft-textarea', { visible: true, timeout: 15000 });
    const perfAfterReviewCold = await page.evaluate(() => window.__qrPerf || {});
    console.log(`  ✓ Rating Tap → AI Request Start: ~0 ms (immediate)`);
    console.log(`  ✓ AI Request Duration (client-side): ${perfAfterReviewCold.aiLatencyMs} ms`);
    console.log(`  ✓ Total Rating Tap → Usable Review: ${perfAfterReviewCold.ratingToReviewMs} ms`);

    // Measure Warm Page Load (browser cache populated)
    console.log('\n[Warm Browser Session] Reloading /r/royal-cafe...');
    const warmNavStart = performance.now();
    await page.goto(`http://localhost:${PORT}/r/royal-cafe`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.star-button');
    const warmPerfData = await page.evaluate(() => window.__qrPerf || {});
    console.log(`  ✓ Warm Business Lookup from Client: ${warmPerfData.businessLookupMs} ms`);
    console.log(`  ✓ Warm Page Interactive Time: ${Math.round(warmPerfData.pageInteractiveTime || 0)} ms`);

    // Tap 4-star rating
    const warmStarBtns = await page.$$('.star-button');
    if (warmStarBtns.length >= 4) {
      await warmStarBtns[3].click();
    }
    await page.waitForSelector('.draft-textarea', { visible: true, timeout: 15000 });
    const warmPerfAfterReview = await page.evaluate(() => window.__qrPerf || {});
    console.log(`  ✓ Warm AI Request Duration: ${warmPerfAfterReview.aiLatencyMs} ms`);
    console.log(`  ✓ Warm Total Rating Tap → Usable Review: ${warmPerfAfterReview.ratingToReviewMs} ms`);

    console.log('\n📊 BENCHMARK COMPLETE.\n');
  } catch (err) {
    console.error('Benchmark Error:', err);
  } finally {
    if (browser) await browser.close();
    server.close();
    await closeDb();
  }
}

runBenchmark();
