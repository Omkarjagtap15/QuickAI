import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * QuickAI Full API Stress & Provider Outage Resilience Benchmark
 *
 * Tests the system under simulated 30% provider failure rates.
 * Compares blocking v1 architecture (cascading failures & 30s hangs)
 * against v2 BullMQ queue + Opossum circuit breaker + fallback.
 */

const errorRate = new Rate('error_rate');
const jobLatency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '15s', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    error_rate: ['rate<0.05'], // Target < 5% errors with circuit breaker + retry fallback
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-mock-token';

export default function () {
  const rand = Math.random();
  let res;

  if (rand < 0.5) {
    // 50% Text Generation
    res = http.post(
      `${BASE_URL}/api/ai/generate-article`,
      JSON.stringify({ topic: 'System Design Patterns', length: 500 }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
      }
    );
  } else if (rand < 0.8) {
    // 30% Feed reading
    res = http.get(`${BASE_URL}/api/user/get-published-creations?limit=20`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
  } else {
    // 20% Dashboard data
    res = http.get(`${BASE_URL}/api/user/get-user-creations`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
  }

  jobLatency.add(res.timings.duration);
  const success = res.status === 200 || res.status === 202; // 202 Accepted for async jobs
  errorRate.add(!success);

  check(res, {
    'request succeeded or queued': () => success,
  });

  sleep(0.2);
}
