# QuickAI Engineering Benchmarks & Load Tests

This directory contains automated k6 benchmark suites used to stress test QuickAI, replicate race conditions and latency bottlenecks, and measure the architectural improvements made to the system.

> **Honest Disclosure**: Load tests are executed against a configurable local mock provider (`server/mock-provider/`) mimicking Gemini and ClipDrop. This ensures deterministic, reproducible results without incurring third-party API costs or violating vendor rate limits.

---

## Benchmark Suites

| Script | Problem Tested | Before (v1) | After (v2) | Target |
|---|---|---|---|---|
| `k6/quota-race.js` | Free-tier quota race condition (50 concurrent VUs, limit 10) | 15–40 requests leaked | **0 leaks** | `over_limit_successes == 0` |
| `k6/auth-latency.js` | Auth middleware p95 latency (Clerk network hops on hot path) | 180–350ms (2 Clerk API calls) | **15–30ms (0 Clerk hops)** | auth p95 reduction > 85% |
| `k6/likes-concurrency.js` | Lost updates under 200 concurrent likes | In-memory read-modify-write lost ~60% | **0 lost likes (exact 200)** | Atomic join table |
| `k6/feed-performance.js` | Unindexed `SELECT *` vs Keyset pagination at 100k rows | Full table seq scan, large payloads | **Index scan, 20-item page** | Payload MB → KB |
| `k6/api-stress.js` | Resilience under 30% provider failure rate | 70% success, 30s hangs | **99%+ success (Circuit breaker + retry)** | Graceful degradation |

---

## How to Run

### 1. Prerequisites
- Install [k6](https://k6.io/docs/get-started/installation/):
  ```bash
  # Windows (winget or choco)
  winget install k6 --source winget
  ```
- Start the mock AI provider:
  ```bash
  cd server/mock-provider
  npm install
  npm start # runs on http://localhost:4000
  ```
- Start the QuickAI backend pointing to the mock provider:
  ```bash
  cd server
  npm run server
  ```

### 2. Running Individual Benchmarks
```bash
# 1. Quota race condition test (50 concurrent users)
k6 run -e BASE_URL=http://localhost:3000 -e AUTH_TOKEN=test-token benchmarks/k6/quota-race.js

# 2. Likes concurrency test (200 concurrent likes)
k6 run -e BASE_URL=http://localhost:3000 -e CREATION_ID=1 benchmarks/k6/likes-concurrency.js

# 3. Auth latency comparison
k6 run -e BASE_URL=http://localhost:3000 benchmarks/k6/auth-latency.js

# 4. Feed pagination performance
k6 run -e BASE_URL=http://localhost:3000 -e PAGINATED=true benchmarks/k6/feed-performance.js

# 5. Full system stress test with simulated provider errors
k6 run -e BASE_URL=http://localhost:3000 benchmarks/k6/api-stress.js
```
