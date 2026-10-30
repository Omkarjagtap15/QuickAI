import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

/**
 * QuickAI Auth Middleware Latency Benchmark
 *
 * Compares:
 * Before: auth middleware invoking clerkClient.users.getUser() + updateUserMetadata() on hot path
 * After: in-memory JWT plan verification + local database query (0 Clerk network hops)
 */

const authLatency = new Trend('auth_middleware_latency');

export const options = {
  scenarios: {
    auth_check: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-mock-token';

export default function () {
  const url = `${BASE_URL}/api/user/get-user-creations`;
  const params = {
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  };

  const res = http.get(url, params);
  authLatency.add(res.timings.duration);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
