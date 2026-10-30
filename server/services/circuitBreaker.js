import CircuitBreaker from 'opossum';
import { logger } from './logger.js';

/**
 * Circuit Breakers for External AI Providers
 *
 * Protects against cascading failures, API outages, and thread pool exhaustion.
 * If failure rate exceeds 50% over a rolling window, the breaker trips OPEN
 * and returns immediate fallback/degraded responses without hanging the caller.
 */

const breakerOptions = {
  timeout: 45000, // 10s timeout on external calls
  errorThresholdPercentage: 50, // Trip breaker if 50% fail
  resetTimeout: 30000, // Try again after 30s
  rollingCounttimeout: 45000,
  rollingCountBuckets: 10,
};

function setupBreakerEvents(breaker, name) {
  breaker.on('open', () => {
    logger.warn({ event: 'circuit_breaker_open', provider: name, message: `Circuit for ${name} opened! Serving fallbacks.` });
  });

  breaker.on('halfOpen', () => {
    logger.info({ event: 'circuit_breaker_half_open', provider: name, message: `Circuit for ${name} is half-open. Testing provider health.` });
  });

  breaker.on('close', () => {
    logger.info({ event: 'circuit_breaker_close', provider: name, message: `Circuit for ${name} closed. Provider recovered.` });
  });

  breaker.on('fallback', (result) => {
    logger.warn({ event: 'circuit_breaker_fallback_invoked', provider: name });
  });
}

/**
 * Creates a protected action wrapped in an Opossum circuit breaker.
 */
export function createBreaker(fn, name, fallbackFn) {
  const breaker = new CircuitBreaker(fn, {
    ...breakerOptions,
    name,
  });

  if (fallbackFn) {
    breaker.fallback(fallbackFn);
  }

  setupBreakerEvents(breaker, name);
  return breaker;
}

