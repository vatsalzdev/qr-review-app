/**
 * Production Load & Stress Test Runner
 * Executes Progressive Concurrency Levels 1 through 6, Scenario A (Viral QR), and Scenario B (Multi-Business)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runLoadTestLevel } from './load-harness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('================================================================');
  console.log('⚡ QR REVIEW APP — PHASE 5 PRODUCTION LOAD & STRESS TEST SUITE ⚡');
  console.log('Target: https://qr-review-app-2mat.vercel.app/');
  console.log('Started at: ' + new Date().toISOString());
  console.log('================================================================\n');

  const allResults = {
    metadata: {
      targetUrl: 'https://qr-review-app-2mat.vercel.app/',
      testedAt: new Date().toISOString(),
      nodeVersion: process.version
    },
    levels: {},
    scenarioA: null,
    scenarioB: null
  };

  const LEVELS = [10, 50, 100, 250, 500];

  for (const concurrency of LEVELS) {
    const res = await runLoadTestLevel({
      concurrency,
      totalRequests: concurrency,
      businessDistribution: [{ slug: 'royal-cafe', businessName: 'Royal Cafe', type: 'cafe', weight: 1.0 }],
      timeoutMs: 20000,
      onProgress: (done, total) => {
        process.stdout.write(`\r  Progress: ${done}/${total} requests completed...`);
      }
    });
    process.stdout.write('\n');
    allResults.levels[concurrency] = res;

    // Safety check: if failure rate > 50%, pause escalating
    if (res.failed > res.total * 0.5) {
      console.warn(`⚠️ High failure rate (${res.failed}/${res.total}) detected at concurrency ${concurrency}. Stopping further escalation for safety.`);
      break;
    }

    console.log(`\n⏳ Cooling down for 6 seconds before next tier...`);
    await sleep(6000);
  }

  // -------------------------------------------------------------------------
  // Scenario A: Viral QR (1,000 users hitting the SAME business QR)
  // -------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log('🔥 SCENARIO A: VIRAL QR — 1,000 Customers Scanning Royal Cafe QR');
  console.log('============================================================');
  const scenarioARes = await runLoadTestLevel({
    concurrency: 1000,
    totalRequests: 1000,
    businessDistribution: [{ slug: 'royal-cafe', businessName: 'Royal Cafe', type: 'cafe', weight: 1.0 }],
    timeoutMs: 25000,
    onProgress: (done, total) => {
      process.stdout.write(`\r  Scenario A Progress: ${done}/${total} requests completed...`);
    }
  });
  process.stdout.write('\n');
  allResults.scenarioA = scenarioARes;
  allResults.levels[1000] = scenarioARes;

  console.log(`\n⏳ Cooling down for 10 seconds before Multi-Business scenario...`);
  await sleep(10000);

  // -------------------------------------------------------------------------
  // Scenario B: Multi-Business Load (200 Cafe A, 300 Cafe B, 500 Club/Bar C)
  // -------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log('🏪 SCENARIO B: MULTI-BUSINESS LOAD (200 Royal Cafe, 300 Waffle Shop, 500 XYZ Bar)');
  console.log('============================================================');
  const scenarioBRes = await runLoadTestLevel({
    concurrency: 1000,
    totalRequests: 1000,
    businessDistribution: [
      { slug: 'royal-cafe', businessName: 'Royal Cafe', type: 'cafe', weight: 0.20 },
      { slug: 'demo-waffle-shop', businessName: 'Demo Waffle Shop', type: 'waffle shop', weight: 0.30 },
      { slug: 'xyz-bar', businessName: 'XYZ Bar', type: 'cocktail bar', weight: 0.50 }
    ],
    timeoutMs: 25000,
    onProgress: (done, total) => {
      process.stdout.write(`\r  Scenario B Progress: ${done}/${total} requests completed...`);
    }
  });
  process.stdout.write('\n');
  allResults.scenarioB = scenarioBRes;

  // Persist all results
  const outputPath = path.resolve(__dirname, 'load_test_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`\n💾 Raw results successfully saved to: ${outputPath}`);
  console.log('\n🎉 ALL LOAD AND STRESS TESTS COMPLETE!\n');
}

main().catch(err => {
  console.error('Fatal load test runner error:', err);
  process.exit(1);
});
