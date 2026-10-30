import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

/**
 * QuickAI Feed Performance & Pagination Benchmark
 *
 * Measures:
 * 1. Feed latency (p50, p95, p99)
 * 2. Response payload size in bytes
 *
 * Demonstrates the transition from full unindexed table scans (SELECT *)
 * to indexed keyset pagination (LIMIT 20 with cursor).
 */

const feedDuration = new Trend('feed_query_duration');
const payloadSize = new Trend('feed_payload_size_bytes');

export const options = {
  scenarios: {
    feed_scan: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-mock-token';
const USE_PAGINATION = __ENV.PAGINATED === 'true';

export default function () {
  const query = USE_PAGINATION ? '?limit=20' : '';
  const url = `${BASE_URL}/api/user/get-published-creations${query}`;

  const params = {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  };

  const res = http.get(url, params);
  feedDuration.add(res.timings.duration);
  payloadSize.add(res.body ? res.body.length : 0);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
