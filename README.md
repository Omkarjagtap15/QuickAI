# QuickAI — Resilient AI SaaS Platform

[![Live Demo](https://img.shields.io/badge/Live_Demo-quick--ai--nine--chi.vercel.app-5046e5?style=for-the-badge&logo=vercel)](https://quick-ai-nine-chi.vercel.app/)
[![Stack](https://img.shields.io/badge/Stack-Express_5_·_React_19_·_Neon_PG-336791?style=for-the-badge)](https://github.com/Omkarjagtap15/QuickAI)
[![Load Tested](https://img.shields.io/badge/Benchmarked-k6-7D64FF?style=for-the-badge&logo=k6)](benchmarks/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

A multi-provider AI content platform with **atomic quota metering**, **circuit-broken provider resilience**, and **normalized social data at scale**. Built to solve real production problems — free-tier abuse, upstream outages, and write contention — with measured before/after results.

**[Live Demo](https://quick-ai-nine-chi.vercel.app/)** · **[Architecture Deep-Dive](ARCHITECTURE_AND_INTERVIEW_DEEPDIVE.md)** · **[Benchmark Scripts](benchmarks/)**

---

## 📸 Platform Preview

<div align="center">
  <img src="docs/assets/hero-landing.png" alt="QuickAI Platform Landing Page" width="100%" style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.12);" />
  <p><em>QuickAI Creator Platform — Production-ready multi-provider AI SaaS with zero-friction demo access</em></p>
</div>

<br />

| AI Studio: Long-Form Article Generator | AI Studio: SEO Blog Titles Engine |
| :---: | :---: |
| <img src="docs/assets/write-article.png" alt="Write Article Studio" width="100%" style="border-radius: 8px;" /> | <img src="docs/assets/blog-titles.png" alt="SEO Blog Titles" width="100%" style="border-radius: 8px;" /> |

| Instant Guest Demo (No Sign-Up Barrier) | Scalable Keyset Community Feed |
| :---: | :---: |
| <img src="docs/assets/demo-access.png" alt="Instant Guest Demo Mode" width="100%" style="border-radius: 8px;" /> | <img src="docs/assets/community-feed.png" alt="Community Feed" width="100%" style="border-radius: 8px;" /> |

---

## What It Does

QuickAI is an AI-powered content platform offering six tools behind a unified quota and resilience layer:

| Tool | What It Does | Provider |
| :--- | :--- | :--- |
| **Write Article** | Generates structured long-form articles from a topic | Google Gemini |
| **Blog Titles** | Produces SEO-optimized blog title suggestions | Google Gemini |
| **Generate Images** | Text-to-image diffusion from a prompt and style | ClipDrop |
| **Remove Background** | AI background removal from uploaded images | Cloudinary AI |
| **Remove Object** | Generative object erasure from photos | Cloudinary AI |
| **Review Resume** | Parses uploaded PDF resumes and provides structured feedback | Google Gemini |
| **Community Feed** | Paginated social feed with likes for published creations | — |

> **Instant Demo Access:** Evaluators and recruiters can click **"Launch Instant Demo"** directly on `/ai` to test all 6 AI tools with free quota (10 requests) with zero sign-up friction. Alternatively, sign in with any email via Clerk to save personal creations. No credit card required.

---

## Results at a Glance

All benchmarks ran against a [mock provider](#mock-ai-provider) using [k6 load tests](benchmarks/) on the optimized codebase. "Before" numbers were captured against the [v1-baseline code](#reproducing-the-benchmarks) (`8a4eaba`).

| Problem | Fix | Result (k6, mock provider) |
| :--- | :--- | :--- |
| Free-tier quota leaked 18–34 of 50 concurrent requests | Atomic SQL metering (`UPDATE ... WHERE count < 10 RETURNING`) | **0 leaked** across 20 runs |
| Provider slowdowns blocked HTTP threads for 5–20s | Circuit breakers + async jobs (202 + SSE) | Time-to-acknowledge: **42ms**; 99.6% of requests handled (93% full result, 6.6% degraded fallback) at 30% simulated failure |
| 64 of 200 concurrent likes lost (array read-modify-write) | Normalized join table with composite PK | **0 lost**, exact 200/200 count |
| Feed query at 100k rows: 128ms sequential scan | Composite keyset pagination + partial B-Tree index | **1.4ms** index scan, 16.8 KB per page (down from ~2.4 MB) |

---

## Architecture

```mermaid
flowchart TD
    Client["React 19 · Clerk Auth · Vite"] -->|"HTTPS + JWT"| Gateway["Express 5 Gateway"]

    subgraph Middleware ["Security & Quota Layer"]
        Gateway --> RateLimit["Rate Limiter (300 req/15 min)"]
        RateLimit --> Auth["Auth Middleware (JWT claims, 0 network hops)"]
        Auth --> Validate["Server-Side Validation & Prompt Templates"]
        Validate --> Quota["Atomic Quota Guard (PostgreSQL)"]
    end

    subgraph Execution ["AI Execution Pipeline"]
        Quota -->|"Text"| CB1["Circuit Breaker"]
        CB1 --> Gemini["Gemini REST API"]
        CB1 -.->|"Breaker OPEN"| Fallback1["Degraded Template"]

        Quota -->|"Image/File"| AsyncQ["Async Job Queue"]
        AsyncQ -->|"HTTP 202 + jobId"| Client
        AsyncQ --> CB2["Circuit Breaker"]
        CB2 --> ClipDrop["ClipDrop API"]
        CB2 --> Cloudinary["Cloudinary CDN"]
        AsyncQ -->|"SSE progress"| Client
    end

    subgraph Data ["Neon PostgreSQL"]
        Quota -->|"Atomic UPDATE"| Usage[("usage")]
        Gateway --> Feed[("creations (partial index)")]
        Gateway --> Likes[("likes (PK: creation_id, user_id)")]
        AsyncQ --> Jobs[("jobs (JSONB)")]
    end
```

### Async Job Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant Q as Job Queue
    participant P as ClipDrop/Cloudinary
    participant DB as PostgreSQL

    C->>S: POST /api/ai/generate-image-async
    S->>DB: Atomic quota check (UPDATE ... RETURNING)
    S->>DB: INSERT job (status: pending)
    S-->>C: 202 Accepted { jobId }
    Note over C: Client connects to SSE stream

    Q->>P: Execute with circuit breaker
    alt Provider succeeds
        Q->>DB: UPDATE job (status: completed)
        Q-->>C: SSE: { status: completed, result }
    else Provider fails (attempt 1)
        Q->>Q: Exponential backoff (1s → 2s → 4s)
        Q->>P: Retry (up to 3 attempts)
    else All retries exhausted
        Q->>DB: UPDATE job (status: failed)
        Q->>DB: Refund quota (count - 1)
        Q-->>C: SSE: { status: failed, error }
    end
```

---

## Engineering Problems Solved

### 1. Free-Tier Quota Race Condition

**Problem:** Free-tier accounts are limited to 10 requests. The original code tracked usage via Clerk user metadata: `getUser()` → read count → `updateUserMetadata(count + 1)`. Under concurrent requests, all reads see the same stale count before any write completes, letting 18–34 requests slip through per 50-user burst. Each leaked request incurs a billable LLM or diffusion API call.

**Solution:** Replaced the non-atomic metadata loop with a single row-level atomic SQL statement:

```sql
UPDATE usage SET count = count + 1, updated_at = NOW()
WHERE user_id = $1 AND count < 10
RETURNING count;
-- 0 rows returned = quota exhausted → HTTP 429
```

PostgreSQL serializes concurrent updates on the same row via its MVCC row-level lock. The `WHERE count < 10` condition is evaluated inside the atomic update, so the 11th concurrent request receives 0 rows and is rejected before any AI call is made.

Simultaneously removed `clerkClient.users.getUser()` from the request hot path — identity and plan are extracted from the signed JWT claims decoded in-memory.

**Trade-off:** JWT-claim auth is eventually consistent. Plan upgrades take effect when the Clerk session token refreshes (~60 seconds). Quota is still enforced in the database, so over-use is impossible, but plan upgrades are delayed by up to one token refresh cycle.

| Metric | Before | After | Note |
| :--- | :---: | :---: | :--- |
| Over-limit requests (50 VUs, limit 10, 20 runs) | 18–34 leaked | **0** | k6 `quota-race.js` against mock provider |
| Auth middleware p95 | ~215ms | **~12ms** | Clerk network hop eliminated |
| External API calls per request | 2 | **0** | JWT decoded in-memory |

---

### 2. Provider Resilience: Circuit Breakers, Async Jobs & Quota Refunds

**Problem:** Image generation, background removal, and resume review block the HTTP thread for 5–20 seconds while waiting on third-party APIs. When providers degrade (high latency or partial outage), connections back up, saturating the event loop and cascading into full platform failure.

**Solution:**

1. **Opossum circuit breakers** wrap all external calls. Configuration: 45s timeout, 50% error-rate trip threshold, 30s reset cooldown with half-open canary probes. Once the breaker opens, subsequent requests fail fast (~15ms) or return a deterministic degraded fallback — but the first requests to trigger the trip still wait up to the timeout.

2. **Async job pipeline** (`/api/ai/generate-image-async`): returns HTTP `202 Accepted` with a `jobId` immediately. The job executes in the background with exponential backoff retries (1s → 2s → 4s, max 3 attempts). Clients subscribe to progress via Server-Sent Events (SSE).

3. **Quota refund on failure:** When a provider call fails after quota was consumed, a compensating `UPDATE usage SET count = GREATEST(count - 1, 0)` refunds the unit so users aren't penalized for upstream failures.

**Honest framing on latency:** The 42ms figure is *time to acknowledge* (HTTP 202). Total time to a completed image result is still provider-dependent (typically 3–8s). The async design improves **responsiveness** and **socket utilization**, not total work time.

| Metric | Before | After | Note |
| :--- | :---: | :---: | :--- |
| Time to acknowledge (image gen) | 5,420ms (blocking) | **42ms** (202 Accepted) | User sees immediate feedback |
| Time to completed result (p95) | 5,420ms | **~6,200ms** | Same provider latency, but non-blocking |
| Requests handled at 30% failure | 70.1% success | **99.6% handled** (93% full result, 6.6% degraded fallback) | k6 `api-stress.js` |
| Behavior during full outage | 30s connection timeout | **Fast-fail after breaker opens** (~15ms) | First requests to trip still wait up to timeout |

---

### 3. Community Feed: Likes Integrity & Query Scale

**Problem:** Likes were stored as a PostgreSQL text array on the `creations` table (`likes text[]`). Toggling a like required read → JavaScript `.includes()` / `.filter()` → write back. Under 200 concurrent likes on the same creation, 64 likes were lost (32% write loss). The feed ran an unindexed `SELECT * FROM creations WHERE publish = true` returning the entire table on every page load.

**Solution:**

1. **Normalized join table** with a composite primary key enforcing uniqueness at the database engine level:
   ```sql
   CREATE TABLE likes (
     creation_id INT REFERENCES creations(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL,
     PRIMARY KEY (creation_id, user_id)
   );
   ```

2. **Atomic toggle:** `INSERT ... ON CONFLICT DO NOTHING RETURNING *`. If 0 rows return, execute `DELETE`.

3. **Composite keyset pagination** with a partial index to prevent row skipping when timestamps tie:
   ```sql
   CREATE INDEX idx_creations_published_feed
   ON creations(created_at DESC, id DESC) WHERE publish = true;

   -- Query: WHERE (created_at, id) < ($cursor, $cursorId) ORDER BY created_at DESC, id DESC LIMIT 20
   ```

| Metric | Before | After | Note |
| :--- | :---: | :---: | :--- |
| Lost likes (200 concurrent users) | 64 lost (136/200) | **0 lost** (200/200) | k6 `likes-concurrency.js` |
| Feed query at 100k rows | 128ms (seq scan) | **1.4ms** (index scan) | `EXPLAIN ANALYZE` |
| Feed response size | ~2.4 MB (unbounded) | **16.8 KB** (page of 20) | — |

---

### 4. Security & Abuse Hardening

- **Server-side prompt templates:** All AI prompts are constructed server-side with sanitized user input as data arguments. Clients cannot supply or override system-level instructions. This prevents prompt override attacks but does not filter adversarial content embedded within user input (full prompt injection defense would require output filtering or guardrails).
- **Server-side token capping:** Hard ceiling on `max_tokens` (1,600 for articles, 120 for titles), discarding client overrides to prevent token-exhaustion billing abuse.
- **Upload limits:** Multer enforces a 10 MB file size ceiling and MIME-type allowlist (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`). Resume review additionally caps at 5 MB.
- **Async temp-file cleanup:** Uploaded files are deleted via `fs/promises.unlink()` in `finally` blocks on every code path (success and failure), preventing disk/inode exhaustion.
- **Structured cost telemetry:** Every AI call logs `latencyMs`, `promptTokens`, `completionTokens`, and estimated `costUsd` as structured JSON for operational auditability.

---

## ⚖️ Trade-offs & Known Limitations

- **JWT-claim auth is eventually consistent.** Plan changes (free → premium) take effect when the Clerk session token refreshes (~60s). Over-use is still impossible because quota is enforced in the database, but upgrades are delayed by up to one refresh cycle.
- **Circuit breaker state is per server instance.** On Vercel's serverless platform, each function invocation has its own breaker state. Production at scale would need a gateway-level breaker (e.g., Istio) or shared state via Redis.
- **The job queue is in-process** (`EventEmitter` + `setImmediate`), backed by the PostgreSQL `jobs` table for persistence. Jobs survive reads (status polling via `/api/ai/job/:jobId`) but not mid-execution restarts. Production path: BullMQ + Redis, or Vercel's QStash for durable serverless queues.
- **Quota is consumed before the provider call.** If the provider fails, a compensating decrement refunds the unit. This means transient failures don't permanently consume quota, but there is a brief window where the count is inflated.
- **Benchmarks ran against a mock provider** with configurable latency and failure injection. Absolute latency numbers reflect the overhead of our code, not real-world Gemini/ClipDrop response times.
- **"Multi-provider" means resilience, not LLM failover.** Text generation uses Gemini with a deterministic degraded fallback, not a secondary LLM. Adding a second text provider (e.g., Groq, OpenRouter) is on the roadmap.

---

## API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/ai/generate-article` | ✓ | Synchronous article generation |
| `POST` | `/api/ai/generate-article-stream` | ✓ | SSE streaming article generation |
| `POST` | `/api/ai/generate-blog-title` | ✓ | Blog title suggestions |
| `POST` | `/api/ai/generate-image` | ✓ | Synchronous image generation (ClipDrop → Cloudinary) |
| `POST` | `/api/ai/generate-image-async` | ✓ | Async image generation (returns 202 + jobId) |
| `GET` | `/api/ai/job/:jobId` | ✓ | Poll job status |
| `GET` | `/api/ai/job-stream/:jobId` | ✓ | SSE stream for job progress |
| `POST` | `/api/ai/remove-image-background` | ✓ | Background removal (multipart upload) |
| `POST` | `/api/ai/remove-image-object` | ✓ | Object removal (multipart upload) |
| `POST` | `/api/ai/resume-review` | ✓ | Resume PDF review (multipart upload, 5 MB limit) |
| `GET` | `/api/user/get-user-creations` | ✓ | User's creation history |
| `GET` | `/api/user/get-published-creations` | ✓ | Paginated community feed (`?cursor=&cursorId=&limit=`) |
| `POST` | `/api/user/toggle-like-creation` | ✓ | Atomic like/unlike toggle |
| `GET` | `/health` | — | Health check with DB, provider, and circuit breaker status |

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Clerk React, React Markdown, Lucide Icons |
| **Backend** | Node.js (ESM), Express 5, Clerk Express |
| **Database** | Neon Serverless PostgreSQL (`@neondatabase/serverless`) |
| **Resilience** | Opossum Circuit Breaker, Custom Job Queue with SSE |
| **AI Providers** | Google Gemini (`gemini-3.5-flash-lite`), ClipDrop (text-to-image) |
| **Storage & CDN** | Cloudinary (uploads, background removal, generative object removal) |
| **Benchmarks** | Grafana k6, Custom Express Mock Provider |
| **Auth** | Clerk (JWT session tokens, in-memory claim validation) |
| **Deployment** | Vercel (frontend + serverless backend) |

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- A PostgreSQL database (recommended: [Neon](https://neon.tech) free tier)
- API keys: [Clerk](https://clerk.com), [Google AI Studio (Gemini)](https://aistudio.google.com/apikey), [ClipDrop](https://clipdrop.co/apis), [Cloudinary](https://cloudinary.com)

### 1. Clone & Install

```bash
git clone https://github.com/Omkarjagtap15/QuickAI.git
cd QuickAI-Full-Stack

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Configure Environment

Copy the example and fill in your keys:

```bash
cd server
cp .env.example .env
```

Required variables in `server/.env`:
```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
GEMINI_API_KEY=AIzaSy...
CLIPDROP_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Create `client/.env`:
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_BACKEND_URL=http://localhost:3000
```

### 3. Run Database Migrations

```bash
cd server
npm run db:migrate
```

### 4. Start Development

```bash
# Terminal 1: Backend
cd server
npm run server     # nodemon on port 3000

# Terminal 2: Frontend
cd client
npm run dev        # Vite on port 5173
```

Open [http://localhost:5173](http://localhost:5173).

---

<details>
<summary><h2>Reproducing the Benchmarks</h2></summary>

All benchmarks run against a zero-cost mock provider. Raw k6 output is committed to `benchmarks/results/`.

### Methodology
- **k6 version:** Latest stable
- **Runs:** Each scenario executed 20 times; tables report the range or median
- **Database:** Neon PostgreSQL (free tier, `us-east-1`)
- **Mock provider:** `server/mock-provider/` with configurable latency (500ms chat, 2000ms image) and failure rate
- **Baseline code:** commit `8a4eaba` (tag `v1-baseline` in `benchmarks/BASELINE_COMMIT.txt`)
- **Optimized code:** latest `main`

### Mock AI Provider

The mock provider emulates Gemini, ClipDrop, and Cloudinary with configurable chaos:

```bash
cd server/mock-provider
npm install
MOCK_LATENCY_MS=500 MOCK_FAILURE_RATE=0 npm start
# http://localhost:4000
```

| Variable | Default | Purpose |
| :--- | :---: | :--- |
| `MOCK_LATENCY_MS` | 500 | Simulated chat response latency |
| `MOCK_FAILURE_RATE` | 0 | Fraction of chat requests that 500 (0.0–1.0) |
| `MOCK_IMAGE_LATENCY_MS` | 2000 | Simulated image generation latency |
| `MOCK_IMAGE_FAILURE_RATE` | 0 | Fraction of image requests that 500 |

### Start the Backend in Test Mode

```bash
cd server
MOCK_AI_URL="http://localhost:4000/v1beta/openai/" \
MOCK_CLIPDROP_URL="http://localhost:4000/text-to-image/v1" \
npm start
```

### Run k6 Suites

| Script | What It Proves | Pass Criterion |
| :--- | :--- | :--- |
| `benchmarks/k6/quota-race.js` | Atomic quota metering under concurrency | 0 over-limit requests across 50 VUs × 20 runs |
| `benchmarks/k6/likes-concurrency.js` | No lost updates with normalized likes table | Final count = exactly 200 after 200 concurrent likes |
| `benchmarks/k6/auth-latency.js` | Auth overhead without Clerk network hops | p95 < 20ms |
| `benchmarks/k6/feed-performance.js` | Keyset pagination vs. full table scan | p95 < 5ms at 100k rows |
| `benchmarks/k6/api-stress.js` | Circuit breaker + retries under 30% failure | > 95% of requests handled (full + degraded) |

```bash
# Run all:
k6 run benchmarks/k6/quota-race.js
k6 run benchmarks/k6/likes-concurrency.js
k6 run benchmarks/k6/auth-latency.js
k6 run benchmarks/k6/feed-performance.js
k6 run benchmarks/k6/api-stress.js
```

</details>

---

## Roadmap

- [ ] **Secondary LLM failover:** Add Groq or OpenRouter as a real secondary text provider (making "multi-provider" literal for text generation)
- [ ] **Durable job queue:** Migrate from in-process `EventEmitter` to BullMQ + Redis (or Vercel QStash) for jobs that survive cold starts
- [ ] **k6 results dashboard:** Publish raw k6 JSON output to a Grafana Cloud dashboard with historical trend tracking
- [ ] **Webhook idempotency:** Add idempotency keys to async job callbacks to prevent duplicate processing on network retries
- [ ] **Composite cursor on frontend:** Update React client to pass `(cursor, cursorId)` for deterministic infinite scroll

---

## What I Learned

Building QuickAI taught me that the interesting engineering in AI applications isn't in the AI calls themselves — it's in the concurrency, resilience, and cost control around them. The quota race condition was invisible until I wrote the k6 script that exposed it. The circuit breaker only mattered once I simulated failures. And keyset pagination only showed its value against a seeded 100k-row dataset. The lesson: **if you can't reproduce the problem, you can't prove the fix.**

---

## License

MIT
