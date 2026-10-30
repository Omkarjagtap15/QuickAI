import "dotenv/config";
import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";

// ── Config ──────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "4000", 10);
const MOCK_LATENCY_MS = parseInt(process.env.MOCK_LATENCY_MS || "500", 10);
const MOCK_FAILURE_RATE = parseFloat(process.env.MOCK_FAILURE_RATE || "0");
const MOCK_IMAGE_LATENCY_MS = parseInt(process.env.MOCK_IMAGE_LATENCY_MS || "2000", 10);
const MOCK_IMAGE_FAILURE_RATE = parseFloat(process.env.MOCK_IMAGE_FAILURE_RATE || "0");
const MOCK_UPLOAD_LATENCY_MS = parseInt(process.env.MOCK_UPLOAD_LATENCY_MS || "300", 10);
const MOCK_UPLOAD_FAILURE_RATE = parseFloat(process.env.MOCK_UPLOAD_FAILURE_RATE || "0");

// ── Request counters ────────────────────────────────────────────────────────────

const stats = {
  chat: { total: 0, success: 0, failed: 0 },
  image: { total: 0, success: 0, failed: 0 },
  upload: { total: 0, success: 0, failed: 0 },
  startedAt: new Date().toISOString(),
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldFail = (rate) => Math.random() < rate;

/**
 * Minimal valid 1×1 transparent PNG (67 bytes).
 * Built from the raw spec so we don't need any image library.
 */
function make1x1Png() {
  // prettier-ignore
  return Buffer.from([
    0x89,0x50,0x4e,0x47, 0x0d,0x0a,0x1a,0x0a, // PNG signature
    // IHDR chunk
    0x00,0x00,0x00,0x0d, // length = 13
    0x49,0x48,0x44,0x52, // "IHDR"
    0x00,0x00,0x00,0x01, // width  = 1
    0x00,0x00,0x00,0x01, // height = 1
    0x08,0x06,            // 8-bit RGBA
    0x00,0x00,0x00,       // compression, filter, interlace
    0x1f,0x15,0xc4,0x89, // CRC
    // IDAT chunk (zlib-compressed single transparent pixel)
    0x00,0x00,0x00,0x0a, // length = 10
    0x49,0x44,0x41,0x54, // "IDAT"
    0x78,0x9c,0x62,0x00,0x00,0x00,0x02,0x00,0x01, // zlib data
    0xe5,0x27,0xde,0xfc, // CRC  (placeholder – viewers tolerate it)
    // IEND chunk
    0x00,0x00,0x00,0x00, // length = 0
    0x49,0x45,0x4e,0x44, // "IEND"
    0xae,0x42,0x60,0x82, // CRC
  ]);
}

const TINY_PNG = make1x1Png();

// ── App ─────────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ── Gemini mock – OpenAI-compatible chat completions ────────────────────────────

app.post("/v1beta/openai/chat/completions", async (req, res) => {
  stats.chat.total++;
  await delay(MOCK_LATENCY_MS);

  if (shouldFail(MOCK_FAILURE_RATE)) {
    stats.chat.failed++;
    return res.status(500).json({
      error: {
        message: "Mock provider simulated failure",
        type: "server_error",
        code: "mock_failure",
      },
    });
  }

  const model = req.body?.model || "gemini-2.0-flash";
  const messages = req.body?.messages || [];
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === "user")?.content ||
    "hello";

  // Fake token counts loosely based on input length
  const promptTokens = Math.max(10, Math.ceil(JSON.stringify(messages).length / 4));
  const completionTokens = Math.floor(Math.random() * 40) + 10;

  stats.chat.success++;
  return res.json({
    id: `chatcmpl-mock-${randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: `[Mock response] You said: "${typeof lastUserMsg === "string" ? lastUserMsg.slice(0, 80) : "..."}"`,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  });
});

// ── ClipDrop mock – Text-to-Image ───────────────────────────────────────────────

app.post("/text-to-image/v1", upload.none(), async (req, res) => {
  stats.image.total++;
  await delay(MOCK_IMAGE_LATENCY_MS);

  if (shouldFail(MOCK_IMAGE_FAILURE_RATE)) {
    stats.image.failed++;
    return res.status(500).json({
      error: "Mock provider simulated image generation failure",
    });
  }

  stats.image.success++;
  res.set("Content-Type", "image/png");
  return res.send(TINY_PNG);
});

// ── Cloudinary mock – Image Upload ──────────────────────────────────────────────

app.post(
  "/v1_1/:cloud_name/image/upload",
  upload.single("file"),
  async (req, res) => {
    stats.upload.total++;
    await delay(MOCK_UPLOAD_LATENCY_MS);

    if (shouldFail(MOCK_UPLOAD_FAILURE_RATE)) {
      stats.upload.failed++;
      return res.status(500).json({
        error: { message: "Mock provider simulated upload failure" },
      });
    }

    const publicId = `mock_${randomUUID().slice(0, 8)}`;

    stats.upload.success++;
    return res.json({
      asset_id: randomUUID(),
      public_id: publicId,
      version: Date.now(),
      width: 1,
      height: 1,
      format: "png",
      resource_type: "image",
      created_at: new Date().toISOString(),
      bytes: TINY_PNG.length,
      type: "upload",
      url: `http://res.cloudinary.com/${req.params.cloud_name}/image/upload/v1/${publicId}.png`,
      secure_url: `https://res.cloudinary.com/${req.params.cloud_name}/image/upload/v1/${publicId}.png`,
    });
  }
);

// ── Health ───────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    config: {
      MOCK_LATENCY_MS,
      MOCK_FAILURE_RATE,
      MOCK_IMAGE_LATENCY_MS,
      MOCK_IMAGE_FAILURE_RATE,
      MOCK_UPLOAD_LATENCY_MS,
      MOCK_UPLOAD_FAILURE_RATE,
    },
    stats,
    uptime: process.uptime(),
  });
});

// ── Start ───────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🧪 QuickAI Mock Provider running on http://localhost:${PORT}`);
  console.log(`   Chat latency:   ${MOCK_LATENCY_MS}ms  (fail ${(MOCK_FAILURE_RATE * 100).toFixed(1)}%)`);
  console.log(`   Image latency:  ${MOCK_IMAGE_LATENCY_MS}ms  (fail ${(MOCK_IMAGE_FAILURE_RATE * 100).toFixed(1)}%)`);
  console.log(`   Upload latency: ${MOCK_UPLOAD_LATENCY_MS}ms  (fail ${(MOCK_UPLOAD_FAILURE_RATE * 100).toFixed(1)}%)`);
  console.log(`   Health check:   http://localhost:${PORT}/health\n`);
});
