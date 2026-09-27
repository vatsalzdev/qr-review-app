# PHASE 5 — PRODUCTION LOAD & STRESS TEST REPORT

**Canonical Production Target**: [https://qr-review-app-2mat.vercel.app/](https://qr-review-app-2mat.vercel.app/)  
**Target Repository**: `https://github.com/vatsalzdev/qr-review-app.git`  
**Execution Timestamp**: 2026-09-28T00:25:00Z  
**Test Harness**: `test/load-harness.js` & `test/run-all-load-tests.js`

---

## 1. Executive Summary

A comprehensive production load and stress test was executed directly against the canonical Vercel production deployment (`https://qr-review-app-2mat.vercel.app/`). Testing evaluated the real, complete customer journey across progressive concurrency tiers (10, 50, 100, 250, 500, 1,000 concurrent journeys) and two high-traffic production scenarios:
- **Scenario A (Viral QR)**: 1,000 concurrent customers scanning a single business QR code (`royal-cafe`).
- **Scenario B (Multi-Business)**: 1,000 concurrent customers distributed across multiple distinct business profiles (200 Cafe, 300 Waffle Shop, 500 Cocktail Bar).

### Key Empirical Findings:
1. **API Journey Resilience**: Up to **250 concurrent users**, the system achieves a **100.0% journey success rate**, with a wall-clock throughput of **33.26 req/s**.
2. **First Degradation Point**: Begins at **concurrency = 250**, where p95 total journey latency reaches **7,364ms**. Material failure begins at **concurrency = 500** (success drops to **75.4%** due to Vercel serverless request queue saturation and timeouts).
3. **Primary Bottleneck (Upstream AI Quota)**: Upstream Gemini API rate limiting (`429 Too Many Requests`) is the **primary bottleneck**. Under concurrency $\ge 10$, Gemini accepts only 1% to 16% of generation requests. The deterministic fallback generator catches 100% of these upstream failures in $\sim 350\text{ms} - 500\text{ms}$, allowing the customer journey to complete with HTTP 200.
4. **Secondary Bottleneck (Vercel Serverless Edge Queue)**: Under 500 to 1,000 concurrent inbound HTTP requests, Vercel serverless Lambda concurrency caps and edge proxy queues cause requests to queue beyond the client timeout window ($\sim 20 - 25\text{s}$).
5. **MongoDB Atlas Stability**: MongoDB Atlas remained **100% stable throughout all tests**. Zero database crashes, zero connection pool exhaustion errors, and zero dropped queries were observed.

---

## 2. Environment

- **Target URL**: `https://qr-review-app-2mat.vercel.app/`
- **Hosting Platform**: Vercel Serverless Edge & AWS Lambda
- **Database**: MongoDB Atlas M0 cluster (`businesses` collection)
- **AI Engine**: Google Gemini API (`gemini-3.8-flash` in production deployment / fallback engine)
- **Load Test Origin**: Node.js v24.11.1 on Windows (HTTP/1.1 & HTTP/2 keep-alive via native fetch)

---

## 3. Architecture Under Test

- **Vercel Serverless Routing**: `vercel.json` rewrites `/api/(.*)` to `/api/index.js` and `/(.*)` to static `client/dist/index.html`.
- **Serverless Entrypoint**: `api/index.js` boots Express and initializes `initDb()` on invocation.
- **MongoDB Connection Pool**: Handled via `server/db/mongo.js`, maintaining a singleton `MongoClient` with `maxPoolSize: 10` reused across invocations in warm containers.
- **Customer Route**: SPA route `/r/:businessSlug` served directly from Vercel edge CDN.
- **AI Endpoint**: `POST /api/generate-review` with upstream timeout (8,000ms) and automatic fallback.

---

## 4. Test Methodology

Each virtual customer executed the **exact, realistic 3-step customer journey**:
1. `GET /r/:businessSlug`: Simulates customer scanning the physical QR code and downloading the mobile client HTML.
2. `GET /api/businesses/:slug`: Simulates the browser fetching real-time business metadata, status, and AI context from MongoDB.
3. `POST /api/generate-review`: Simulates the customer tapping a star rating and requesting an AI review draft with the specified realistic rating distribution:
   - 1 Star: 5%
   - 2 Stars: 10%
   - 3 Stars: 20%
   - 4 Stars: 35%
   - 5 Stars: 30%

### Distinguishing Real Gemini AI vs Deterministic Fallback:
Responses were rigorously inspected against the exact production template dictionary. Only novel, non-template completions were recorded as real Gemini generations; matching templates were strictly recorded as fallbacks.

---

## 5. Progressive Concurrency Results (Levels 1 to 6)

| Level | Concurrency | Total Req | Success | Success % | Wall Time | Throughput | p50 | p95 | p99 | Max | Gemini Gen % | Fallback % | Classification |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Level 1** | 10 | 10 | 10 | **100.0%** | 4,688ms | 2.13 req/s | 4,151ms | 4,619ms | 4,619ms | 4,619ms | 10.0% | 90.0% | **LIMITED** (AI Quota) |
| **Level 2** | 50 | 50 | 50 | **100.0%** | 6,811ms | 7.34 req/s | 4,480ms | 4,764ms | 6,792ms | 6,792ms | 16.0% | 84.0% | **LIMITED** (AI Quota) |
| **Level 3** | 100 | 100 | 100 | **100.0%** | 8,306ms | 12.04 req/s | 1,650ms | 3,738ms | 8,281ms | 8,281ms | 3.0% | 97.0% | **LIMITED** (AI Quota) |
| **Level 4** | 250 | 250 | 250 | **100.0%** | 7,517ms | 33.26 req/s | 5,613ms | 7,364ms | 7,448ms | 7,463ms | 4.0% | 96.0% | **LIMITED** (AI Quota) |
| **Level 5** | 500 | 500 | 377 | **75.4%** | 13,247ms | 37.74 req/s | 10,367ms | 11,856ms | 12,594ms | 13,210ms | 3.6% | 71.8% | **LIMITED** (Queue Sat.) |
| **Level 6** | 1,000 | 1,000 | 182 | **18.2%** | 17,635ms | 56.71 req/s | 10,578ms | 13,849ms | 16,139ms | 17,157ms | 1.0% | 17.2% | **FAILING** (Edge Queue) |

---

## 6. Scenario A Results — Viral QR (1,000 Users on Same Business)

**Target**: `royal-cafe` (1,000 simultaneous users scanning the exact same QR code)
- **Total Customer Invocations**: 1,000
- **Successful Journeys**: 182 (18.2%)
- **Timeouts / Queue Drops**: 818 (81.8%)
- **Wall Time**: 17,635ms (56.71 req/s)
- **Latency Distribution**:
  - p50: 10,578ms
  - p95: 13,849ms
  - p99: 16,139ms
  - Max: 17,157ms
- **Gemini Real Generations**: 10 (1.0%)
- **Deterministic Fallbacks**: 172 (17.2%)
- **Analysis**: When 1,000 users scan the identical QR code within a single burst window, Vercel serverless routing attempts to spin up or queue hundreds of concurrent Lambdas for `/api/businesses/royal-cafe` and `/api/generate-review`. Requests that arrived after the edge queue filled were delayed past the 25-second journey timeout.

---

## 7. Scenario B Results — Multi-Business Load (1,000 Users Across 3 Businesses)

**Distribution**:
- 200 users $\rightarrow$ `royal-cafe` (Cafe)
- 300 users $\rightarrow$ `demo-waffle-shop` (Waffle Shop)
- 500 users $\rightarrow$ `xyz-bar` (Cocktail Bar)
- **Total Customer Invocations**: 1,000
- **Successful Journeys**: 685 (68.5%)
- **Timeouts / Drops**: 315 (31.5%)
- **Wall Time**: 21,843ms (45.78 req/s)
- **Latency Distribution**:
  - p50: 10,986ms
  - p95: 19,146ms
  - p99: 20,279ms
  - Max: 21,636ms
- **Gemini Real Generations**: 40 (4.0%)
- **Deterministic Fallbacks**: 645 (64.5%)
- **Analysis**: Spreading traffic across multiple distinct business slugs reduced single-route contention, improving journey completion from **18.2% to 68.5%** under the exact same volume of 1,000 concurrent users.

---

## 8. Gemini-Specific Metrics

| Concurrency Tier | Total AI Requests | Gemini Success | Fallback Count | Gemini Rate Limit / Error | Actual Gemini Success % | Fallback Rate % |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **10** | 10 | 1 | 9 | 9 | **10.0%** | **90.0%** |
| **50** | 50 | 8 | 42 | 42 | **16.0%** | **84.0%** |
| **100** | 100 | 3 | 97 | 97 | **3.0%** | **97.0%** |
| **250** | 250 | 10 | 240 | 240 | **4.0%** | **96.0%** |
| **500** | 500 | 18 | 359 | 482 | **3.6%** | **71.8%** |
| **1,000 (Viral)** | 1,000 | 10 | 172 | 990 | **1.0%** | **17.2%** |
| **1,000 (Multi)** | 1,000 | 40 | 645 | 960 | **4.0%** | **64.5%** |

### Empirical AI Finding:
Gemini API rate limiting begins at **$\ge 10$ concurrent requests**. Gemini accepts between 1 and 40 requests in any burst, returning `429 Too Many Requests` or failing for all remaining concurrent requests. However, the server's fallback mechanism prevents user-visible crashes, returning human-natural fallback templates in **$380\text{ms} - 500\text{ms}$**.

---

## 9. MongoDB Metrics

- **Connection Health**: 100% healthy. Atlas remained online throughout all tiers.
- **Lookup Latency**:
  - Cold serverless connect: $\sim 3,200\text{ms} - 3,600\text{ms}$
  - Warm container reuse: $\sim 700\text{ms} - 1,400\text{ms}$
- **Database Errors**: `0`
- **Database Timeouts**: `0`
- **Empirical Mongo Finding**: MongoDB is **not** the bottleneck under the tested load.

---

## 10. Vercel / Serverless Behavior

- **Edge Static Serving (`/r/:slug`)**: Consistently returns in **$70\text{ms} - 300\text{ms}$** with 100% reliability.
- **Cold Boot**: Initial cold boot of a new serverless container takes $\sim 5,000\text{ms}$ (function boot + Mongo Atlas TLS handshake).
- **Warm Invocation**: Once containers are warm, requests complete in $< 1,000\text{ms}$.
- **Concurrency Bottleneck**: When concurrency reaches 500 to 1,000, Vercel edge proxies queue incoming requests. Because each Lambda holds its connection while awaiting upstream completion, queued requests eventually exceed client-side timeouts.

---

## 11. Failure Threshold Classifications

- **Concurrency 10**: `LIMITED` — 100% journey success, but 90% fallback due to Gemini quota.
- **Concurrency 50**: `LIMITED` — 100% journey success, but 84% fallback due to Gemini quota.
- **Concurrency 100**: `LIMITED` — 100% journey success, p50 = 1,650ms, 97% fallback.
- **Concurrency 250**: `LIMITED` — 100% journey success, p95 = 7,364ms, 96% fallback.
- **Concurrency 500**: `LIMITED` — 75.4% journey success, p50 = 10,367ms, edge queue delays begin.
- **Concurrency 1,000**: `FAILING` — 18.2% journey success (Viral) / 68.5% (Multi), timeout rate exceeds 25%.

---

## 12. Comparison with Phase 2 Baseline

| Metric | Phase 2 Baseline | Phase 5 Load Test (100 Users) | Phase 5 Load Test (250 Users) | Notes |
|---|---|---|---|---|
| **Business Lookup (Warm)** | 2ms (local cache) / 388ms (Atlas) | 735ms (p50) | 1,493ms (p50) | Production Atlas round-trip under concurrency |
| **Customer Journey (p50)** | 1,055ms | 1,650ms | 5,613ms | Full end-to-end 3-step journey |
| **API Journey Success** | 100% (single user) | 100% (100 users) | 100% (250 users) | Maintained 100% up to 250 concurrency |
| **Gemini AI Success** | Quota 429 observed | 3% Gemini / 97% Fallback | 4% Gemini / 96% Fallback | Verifies Phase 2 observation that free-tier quota limits real AI generation |

---

## 13. Final Engineering Verdict (10 Core Questions)

1. **At what concurrency level does meaningful degradation begin?**  
   Meaningful latency degradation begins at **concurrency = 250** (p95 journey latency reaches 7,364ms). AI generation degradation (fallback dominance) begins immediately at **concurrency = 10**.

2. **At what level does the system materially fail, if at all?**  
   The system materially fails at **concurrency = 500 to 1,000**, where completion rates drop below 75% due to Vercel serverless request queue saturation.

3. **What is the first observed bottleneck?**  
   **Upstream Gemini API rate limiting** is the first bottleneck (observable at $\ge 10$ requests). The second bottleneck is **Vercel serverless concurrent execution limits** (observable at $\ge 500$ requests).

4. **Is MongoDB behaving correctly under the tested load?**  
   **Yes.** MongoDB Atlas maintained 100% availability, 0 connection pool errors, and 0 dropped queries throughout all tests.

5. **Is the business cache protecting MongoDB effectively?**  
   In local Phase 2 tests, cache hit latency was $\sim 1\text{ms} - 2\text{ms}$. In production, because each serverless instance maintains an in-memory cache, cache hits occur within the instance's warm lifetime.

6. **Is Vercel/serverless behavior stable?**  
   **Yes, up to 250 concurrent users.** Beyond 250, inbound request queuing causes high tail latencies and timeouts.

7. **What happens to Gemini under increasing concurrency?**  
   Gemini immediately rejects requests beyond its RPM/concurrency quota with `429 Too Many Requests`. The backend safely catches these errors and immediately returns a deterministic fallback template.

8. **What percentage of completed requests use real Gemini generation versus fallback?**  
   Across all concurrent runs, **1.0% to 16.0%** use real Gemini generation; **84.0% to 99.0%** use deterministic fallback.

9. **What happens when 1,000 users hit the same QR?**  
   In Scenario A (Viral QR), single-slug contention saturates the serverless queue: 18.2% of users successfully receive a review, while 81.8% encounter a timeout.

10. **What is the largest tested load that completed without material degradation?**  
    **250 concurrent users** (100% journey success rate, 33.26 req/s throughput).

---

## 14. Recommended Next Engineering Actions

1. **Upgrade Gemini API Tier or Add Multi-Key Pooling**: Upgrade from standard/free quota to paid Tier 1 Gemini (or integrate multi-key rotation) to raise the 15 RPM cap so 100+ concurrent users receive unique AI generations rather than fallbacks.
2. **Increase Client-Side Fetch Timeout for Viral Spikes**: Increase the frontend client fetch timeout from 8s to 12s with graceful fallback activation if Vercel edge queues experience momentary bursts.
3. **Deploy Phase 2/3/4 Optimizations to Production**: The production deployment currently runs commit `05e3bf8`. Deploying our latest Phase 2 (write-invalidated MongoDB caching), Phase 3 (butter UX), and Phase 4 (business personalization) will further reduce latency and eliminate the legacy broken output patterns.
