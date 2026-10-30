# QuickAI Mock Provider Server

A lightweight Express server that imitates **Gemini** (OpenAI-compatible API), **ClipDrop** (text-to-image), and **Cloudinary** (image upload) for load testing and benchmarking.

> **Why?** Running load tests against real APIs is expensive and rate-limited. This mock lets you stress-test QuickAI's backend in isolation with configurable latency and failure rates, so benchmarks are reproducible and honest.

---

## Quick Start

```bash
cd server/mock-provider
cp .env.example .env   # optional – defaults are sane
npm install
npm start              # starts on http://localhost:4000
```

---

## Configuration

All settings are via environment variables (or `.env` file):

| Variable                 | Default | Description                                      |
| ------------------------ | ------- | ------------------------------------------------ |
| `PORT`                   | `4000`  | Port the mock server listens on                  |
| `MOCK_LATENCY_MS`        | `500`   | Simulated delay for chat completion requests     |
| `MOCK_FAILURE_RATE`      | `0`     | Probability of 500 error for chat (0.0 – 1.0)   |
| `MOCK_IMAGE_LATENCY_MS`  | `2000`  | Simulated delay for image generation requests    |
| `MOCK_IMAGE_FAILURE_RATE` | `0`    | Probability of 500 error for image gen           |
| `MOCK_UPLOAD_LATENCY_MS` | `300`   | Simulated delay for Cloudinary upload requests   |
| `MOCK_UPLOAD_FAILURE_RATE`| `0`    | Probability of 500 error for uploads             |

### Example: 20% chat failures with 200ms latency

```bash
MOCK_LATENCY_MS=200 MOCK_FAILURE_RATE=0.2 npm start
```

---

## Endpoints

### `POST /v1beta/openai/chat/completions`

**Gemini mock** — OpenAI-compatible chat completion format.

```bash
curl -X POST http://localhost:4000/v1beta/openai/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-2.0-flash","messages":[{"role":"user","content":"Hello"}]}'
```

Returns a standard `chat.completion` response with fake content and `usage` tokens.

### `POST /text-to-image/v1`

**ClipDrop mock** — Accepts form data with a `prompt` field, returns a 1×1 PNG.

```bash
curl -X POST http://localhost:4000/text-to-image/v1 \
  -F "prompt=a sunset over mountains"
```

### `POST /v1_1/:cloud_name/image/upload`

**Cloudinary mock** — Returns a fake `secure_url` pointing to a placeholder.

```bash
curl -X POST http://localhost:4000/v1_1/my_cloud/image/upload \
  -F "file=@test.png"
```

### `GET /health`

Returns current configuration, request counts, and uptime.

```bash
curl http://localhost:4000/health
```

---

## Pointing QuickAI at the Mock

Set these in the main QuickAI server's `.env`:

```env
GEMINI_BASE_URL=http://localhost:4000
CLIPDROP_API_URL=http://localhost:4000/text-to-image/v1
CLOUDINARY_URL=http://localhost:4000
```

Then run load tests against the main server — all AI calls are intercepted by the mock.
