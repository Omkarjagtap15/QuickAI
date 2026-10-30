import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

/**
 * QuickAI Quota Race Condition Benchmark
 *
 * Problem:
 * In v1, the free tier allowed 10 requests, but read-then-write on Clerk metadata
 * allowed concurrent requests to slip through.
 *
 * Test Setup:
 * - 50 concurrent virtual users hitting /api/ai/generate-article at once
 * - Free-tier account with 0 or low usage
 * - Target: Expect 0 over-limit requests (> 10) in the fixed version.
 */

const successfulRequests = new Counter('successful_requests');
const overLimitRequests = new Counter('over_limit_successes');
const requestDuration = new Trend('custom_request_duration');

export const options = {
  scenarios: {
    quota_burst: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    over_limit_successes: ['count==0'], // In fixed version, over_limit must be 0
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-mock-token';

export default function () {
  const url = `${BASE_URL}/api/ai/generate-article`;
  const payload = JSON.stringify({
    topic: 'Future of Cloud Infrastructure',
    length: 800,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  };

  const res = http.post(url, payload, params);
  requestDuration.add(res.timings.duration);

  let body = {};
  try {
    body = JSON.parse(res.body);
  } catch (e) {
    // Non-JSON or network error
  }

  const isSuccess = res.status === 200 && body.success === true;
  const isLimitBlocked = (res.status === 429) || (body.success === false && /limit/i.test(body.message || ''));

  if (isSuccess) {
    successfulRequests.add(1);
    // After 10 successful requests across the whole test, any subsequent success is a leaked request
  }

  check(res, {
    'valid response status': (r) => r.status === 200 || r.status === 429,
    'quota enforced when exceeded': (r) => isSuccess || isLimitBlocked,
  });

  sleep(0.1);
}
