import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

/**
 * QuickAI Likes Concurrency & Lost Update Benchmark
 *
 * Problem:
 * In v1, liking a creation read the array, appended/filtered in memory, and wrote back.
 * Concurrent likes resulted in lost updates.
 *
 * Test Setup:
 * - 200 concurrent VUs toggle-like the same creation simultaneously.
 * - In the fixed version, every like is an atomic insert into the likes join table.
 */

const successfulToggles = new Counter('successful_toggles');
const toggleDuration = new Trend('toggle_duration');

export const options = {
  scenarios: {
    concurrent_likes: {
      executor: 'per-vu-iterations',
      vus: 200,
      iterations: 1,
      maxDuration: '30s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CREATION_ID = __ENV.CREATION_ID || '1';

export default function () {
  const vuId = __VU; // Unique per virtual user
  const token = `mock-token-user-${vuId}`;

  const url = `${BASE_URL}/api/user/toggle-like-creation`;
  const payload = JSON.stringify({ id: Number(CREATION_ID) });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };

  const res = http.post(url, payload, params);
  toggleDuration.add(res.timings.duration);

  let body = {};
  try {
    body = JSON.parse(res.body);
  } catch (e) {}

  if (res.status === 200 && body.success === true) {
    successfulToggles.add(1);
  }

  check(res, {
    'like toggle succeeded': (r) => r.status === 200,
  });

  sleep(0.05);
}
