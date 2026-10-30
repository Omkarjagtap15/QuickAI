/**
 * QuickAI Zero-Dependency Structured JSON Logger
 *
 * Provides high-throughput, structured observability for AI API invocations,
 * token usage, latency metrics, and dollar cost estimates without native dependencies.
 */

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = process.env.LOG_LEVEL ? (LOG_LEVELS[process.env.LOG_LEVEL] || 20) : 20;

function formatLog(level, obj, msg) {
  if (LOG_LEVELS[level] < currentLevel) return;

  const entry = {
    time: new Date().toISOString(),
    level,
    ...(typeof obj === 'object' && obj !== null ? obj : {}),
    ...(msg ? { msg } : {}),
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (obj, msg) => formatLog('info', obj, msg),
  warn: (obj, msg) => formatLog('warn', obj, msg),
  error: (obj, msg) => formatLog('error', obj, msg),
  debug: (obj, msg) => formatLog('debug', obj, msg),
};

// Gemini Flash pricing approximation: $0.075 per 1M input tokens, $0.30 per 1M output tokens
const COST_PER_1M_INPUT_TOKENS = 0.075;
const COST_PER_1M_OUTPUT_TOKENS = 0.3;

export function calculateCost(promptTokens = 0, completionTokens = 0) {
  const inputCost = (promptTokens / 1_000_000) * COST_PER_1M_INPUT_TOKENS;
  const outputCost = (completionTokens / 1_000_000) * COST_PER_1M_OUTPUT_TOKENS;
  return Number((inputCost + outputCost).toFixed(6));
}

export function logAiMetric({
  userId,
  tool,
  model,
  promptTokens = 0,
  completionTokens = 0,
  latencyMs,
  status = 'success',
  error = null,
}) {
  const costUsd = calculateCost(promptTokens, completionTokens);

  logger.info({
    event: 'ai_request_metric',
    userId,
    tool,
    model,
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    latencyMs,
    costUsd,
    status,
    error: error ? error.message : null,
  });
}
