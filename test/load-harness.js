/**
 * Phase 5 Production Load & Stress Testing Harness
 * 
 * Target: CANONICAL PRODUCTION DEPLOYMENT https://qr-review-app-2mat.vercel.app/
 * Tests full customer journey:
 * 1. GET /r/:businessSlug (Customer Page)
 * 2. GET /api/businesses/:slug (Business Lookup)
 * 3. POST /api/generate-review (AI Generation with realistic rating distribution)
 * 
 * Metrics:
 * - p50, p95, p99, max latency
 * - Status code distribution (200, 429, 5xx, timeouts)
 * - Actual Gemini AI Success vs Deterministic Fallback
 * - Serverless / MongoDB behavior
 */

const BASE_URL = 'https://qr-review-app-2mat.vercel.app';

// Production fallback templates in commit 05e3bf8 (used to distinguish real Gemini vs fallback)
const KNOWN_FALLBACK_PATTERNS = [
  // 5 star
  /Really impressed by .*\. The service was warm and attentive/,
  /Everything about our visit to .*\. was top-notch/,
  /.* consistently delivers excellent quality\. Welcoming team/,
  /Outstanding experience at .*\. The staff was incredibly helpful/,
  /Such a pleasant visit to .*\. Super clean, great customer care/,
  /Top-tier experience with .*\. Prompt service, very welcoming staff/,
  // 4 star
  /Pleasant visit to .*\. The atmosphere was comfortable/,
  /Really solid experience at .*\. Friendly team and everything went smoothly/,
  /Enjoyed my time at .*\. Good overall quality and welcoming service/,
  /Very good visit to .*\. Staff was courteous, the space was tidy/,
  /Good impression of .*\. Welcoming customer service and nice ambience/,
  /.* provided a smooth and enjoyable visit\. Friendly staff/,
  // 3 star
  /An average visit to .*\. The staff was polite/,
  /Mixed feelings about .*\. Some aspects were decent/,
  /Fairly standard experience at .*\. Met basic expectations/,
  /.* was okay overall\. Friendly service, but a few areas/,
  /Decent overall experience at .*\. It wasn't bad, but a few tweaks/,
  // 2 star
  /Unfortunately, the visit to .* fell below expectations/,
  /Disappointing visit to .*\. While the staff was polite/,
  /The experience at .* was underwhelming/,
  /Below average experience at .*\. Found the service/,
  /Expected a higher standard from .*\. Communication and quality/,
  // 1 star
  /Very disappointing experience at .*\. Basic standards were not met/,
  /Substandard visit to .*\. Multiple issues arose/,
  /Frustrating experience with .*\. The quality and attention/,
  /Cannot recommend .* based on this visit/,
  /Poor experience at .*\. Lack of attention to detail/
];

export function isFallbackReview(text) {
  if (!text || typeof text !== 'string') return false;
  return KNOWN_FALLBACK_PATTERNS.some(pattern => pattern.test(text.trim()));
}

export function sampleRating() {
  const rand = Math.random();
  if (rand < 0.05) return 1;       // 5%
  if (rand < 0.15) return 2;       // 10%
  if (rand < 0.35) return 3;       // 20%
  if (rand < 0.70) return 4;       // 35%
  return 5;                        // 30%
}

export function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (pct) => {
    const idx = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
    return sorted[idx];
  };
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    p50: p(50),
    p90: p(90),
    p95: p(95),
    p99: p(99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length)
  };
}

/**
 * Execute a single full customer journey
 */
export async function executeCustomerJourney({ slug = 'royal-cafe', businessName = 'Royal Cafe', type = 'cafe', timeoutMs = 15000 }) {
  const journeyStart = performance.now();
  const result = {
    slug,
    success: false,
    totalDurationMs: 0,
    pageStatus: 0,
    pageDurationMs: 0,
    lookupStatus: 0,
    lookupDurationMs: 0,
    aiStatus: 0,
    aiDurationMs: 0,
    aiType: 'unknown', // 'gemini' | 'fallback' | '429' | 'timeout' | 'error'
    rating: sampleRating(),
    reviewText: '',
    error: null,
    vercelCache: null,
    serverTiming: null
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Step 1: GET /r/:businessSlug (Customer Page HTML)
    const t0 = performance.now();
    const pageRes = await fetch(`${BASE_URL}/r/${slug}`, {
      signal: controller.signal,
      headers: { 'Accept': 'text/html' }
    });
    result.pageDurationMs = Math.round(performance.now() - t0);
    result.pageStatus = pageRes.status;

    // Step 2: GET /api/businesses/:slug (Business Data Lookup)
    const t1 = performance.now();
    const lookupRes = await fetch(`${BASE_URL}/api/businesses/${slug}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    result.lookupDurationMs = Math.round(performance.now() - t1);
    result.lookupStatus = lookupRes.status;
    result.serverTiming = lookupRes.headers.get('server-timing');
    result.vercelCache = lookupRes.headers.get('x-vercel-cache');

    let resolvedName = businessName;
    let resolvedType = type;
    if (lookupRes.ok) {
      try {
        const lookupData = await lookupRes.json();
        if (lookupData.data) {
          resolvedName = lookupData.data.name || resolvedName;
          resolvedType = lookupData.data.type || resolvedType;
        }
      } catch (_) {}
    }

    // Step 3: POST /api/generate-review (AI Review Request)
    const t2 = performance.now();
    const aiRes = await fetch(`${BASE_URL}/api/generate-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        businessName: resolvedName,
        rating: result.rating,
        businessType: resolvedType,
        slug
      }),
      signal: controller.signal
    });
    result.aiDurationMs = Math.round(performance.now() - t2);
    result.aiStatus = aiRes.status;

    if (aiRes.status === 429) {
      result.aiType = '429';
      result.error = 'AI rate limit exceeded (429)';
    } else if (aiRes.ok) {
      const aiData = await aiRes.json();
      result.reviewText = aiData.review || aiData.data?.review || '';
      if (isFallbackReview(result.reviewText)) {
        result.aiType = 'fallback';
      } else {
        result.aiType = 'gemini';
      }
      result.success = true;
    } else {
      result.aiType = 'error';
      result.error = `HTTP ${aiRes.status}`;
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      result.aiType = 'timeout';
      result.error = 'Journey timed out';
    } else {
      result.error = err.message;
      result.aiType = 'error';
    }
  } finally {
    clearTimeout(timer);
    result.totalDurationMs = Math.round(performance.now() - journeyStart);
  }

  return result;
}

/**
 * Run a batch of concurrent users
 */
export async function runLoadTestLevel({
  concurrency = 10,
  totalRequests = null,
  businessDistribution = [{ slug: 'royal-cafe', businessName: 'Royal Cafe', type: 'cafe', weight: 1.0 }],
  timeoutMs = 18000,
  onProgress = null
}) {
  const targetTotal = totalRequests || concurrency;
  console.log(`\n============================================================`);
  console.log(`🚀 Starting Test: Concurrency = ${concurrency}, Total Requests = ${targetTotal}`);
  console.log(`============================================================`);

  const results = [];
  let completed = 0;
  let cursor = 0;

  // Select business based on weights
  function pickBusiness() {
    if (businessDistribution.length === 1) return businessDistribution[0];
    const r = Math.random();
    let acc = 0;
    for (const b of businessDistribution) {
      acc += b.weight;
      if (r <= acc) return b;
    }
    return businessDistribution[businessDistribution.length - 1];
  }

  // Worker task
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= targetTotal) break;

      const targetBiz = pickBusiness();
      const res = await executeCustomerJourney({
        slug: targetBiz.slug,
        businessName: targetBiz.businessName,
        type: targetBiz.type,
        timeoutMs
      });
      results.push(res);
      completed++;

      if (onProgress && (completed % Math.max(1, Math.floor(targetTotal / 10)) === 0 || completed === targetTotal)) {
        onProgress(completed, targetTotal, res);
      }
    }
  }

  const startTime = performance.now();
  const workers = Array.from({ length: Math.min(concurrency, targetTotal) }, () => worker());
  await Promise.all(workers);
  const wallClockMs = Math.round(performance.now() - startTime);

  // Aggregate metrics
  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const failed = total - successful;

  const statusCounts = {};
  let timeoutCount = 0;
  let count429 = 0;
  let count4xx = 0;
  let count5xx = 0;

  let geminiSuccessCount = 0;
  let fallbackCount = 0;

  const journeyLatencies = [];
  const aiLatencies = [];
  const lookupLatencies = [];

  for (const r of results) {
    journeyLatencies.push(r.totalDurationMs);
    if (r.lookupDurationMs > 0) lookupLatencies.push(r.lookupDurationMs);
    if (r.aiDurationMs > 0) aiLatencies.push(r.aiDurationMs);

    const code = r.aiStatus || r.pageStatus || (r.aiType === 'timeout' ? 'timeout' : 'client_err');
    statusCounts[code] = (statusCounts[code] || 0) + 1;

    if (r.aiType === 'timeout') timeoutCount++;
    if (code === 429) count429++;
    if (typeof code === 'number' && code >= 400 && code < 500) count4xx++;
    if (typeof code === 'number' && code >= 500 && code < 600) count5xx++;

    if (r.aiType === 'gemini') geminiSuccessCount++;
    if (r.aiType === 'fallback') fallbackCount++;
  }

  const journeyPct = calculatePercentiles(journeyLatencies);
  const aiPct = calculatePercentiles(aiLatencies);
  const lookupPct = calculatePercentiles(lookupLatencies);

  // Determine health classification
  // HEALTHY: Success >= 95%, p95 latency < 3500ms, 5xx == 0
  // DEGRADED: Success >= 90%, p95 < 6000ms, or partial fallbacks/429
  // LIMITED: Success >= 75%, or high fallback/429 rate
  // FAILING: Success < 75%, or high 5xx/timeouts
  let classification = 'HEALTHY';
  const successRate = (successful / total) * 100;
  const fallbackRate = (fallbackCount / total) * 100;
  const geminiSuccessRate = (geminiSuccessCount / total) * 100;
  const errorRate = (failed / total) * 100;

  if (successRate < 75 || timeoutCount > total * 0.1 || count5xx > total * 0.05) {
    classification = 'FAILING';
  } else if (successRate < 90 || journeyPct.p95 > 6000 || fallbackRate > 75) {
    classification = 'LIMITED';
  } else if (successRate < 98 || journeyPct.p95 > 3500 || fallbackRate > 25 || count429 > 0) {
    classification = 'DEGRADED';
  }

  const summary = {
    concurrency,
    targetTotal,
    wallClockMs,
    throughputRps: (total / (wallClockMs / 1000)).toFixed(2),
    total,
    successful,
    failed,
    successRate: successRate.toFixed(1) + '%',
    classification,
    statusCounts,
    timeoutCount,
    count429,
    count4xx,
    count5xx,
    geminiSuccessCount,
    geminiSuccessRate: geminiSuccessRate.toFixed(1) + '%',
    fallbackCount,
    fallbackRate: fallbackRate.toFixed(1) + '%',
    journeyLatencies: journeyPct,
    aiLatencies: aiPct,
    lookupLatencies: lookupPct
  };

  console.log(`\n📊 RESULTS FOR CONCURRENCY ${concurrency}:`);
  console.log(`  Classification: ${classification}`);
  console.log(`  Wall Time: ${wallClockMs}ms (${summary.throughputRps} req/s)`);
  console.log(`  Journey Success: ${successful}/${total} (${summary.successRate})`);
  console.log(`  Gemini AI Gen: ${geminiSuccessCount}/${total} (${summary.geminiSuccessRate}) | Fallbacks: ${fallbackCount}/${total} (${summary.fallbackRate})`);
  console.log(`  Status Codes:`, statusCounts);
  console.log(`  Journey Latency (p50 / p95 / p99 / max): ${journeyPct.p50}ms / ${journeyPct.p95}ms / ${journeyPct.p99}ms / ${journeyPct.max}ms`);
  console.log(`  AI Gen Latency (p50 / p95 / p99 / max): ${aiPct.p50}ms / ${aiPct.p95}ms / ${aiPct.p99}ms / ${aiPct.max}ms`);
  console.log(`  Lookup Latency (p50 / p95 / p99 / max): ${lookupPct.p50}ms / ${lookupPct.p95}ms / ${lookupPct.p99}ms / ${lookupPct.max}ms`);

  return summary;
}
