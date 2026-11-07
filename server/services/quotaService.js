import sql from '../configs/db.js';

/**
 * Quota Service - Atomic In-Database Metering
 *
 * Problem Solved:
 * Eliminates free-tier quota race conditions where concurrent requests slipped
 * past non-atomic Clerk metadata checks.
 *
 * Method:
 * Utilizes atomic SQL transaction:
 * `UPDATE usage SET count = count + 1 WHERE user_id = $1 AND count < $2 RETURNING count`
 * If the returned count is null or empty, the limit has been reached.
 */

const FREE_TIER_LIMIT = 10;

export async function checkAndIncrementQuota(userId, plan = 'free') {
  // Premium accounts bypass free tier quota limits
  if (plan === 'premium') {
    return {
      allowed: true,
      plan: 'premium',
      currentCount: 0,
      limit: Infinity,
    };
  }

  // 1. Ensure user row exists (idempotent upsert)
  await sql`
    INSERT INTO usage (user_id, count, plan)
    VALUES (${userId}, 0, 'free')
    ON CONFLICT (user_id) DO NOTHING
  `;

  // 2. Atomic increment guarded by limit condition
  const rows = await sql`
    UPDATE usage
    SET count = count + 1, updated_at = NOW()
    WHERE user_id = ${userId} AND count < ${FREE_TIER_LIMIT}
    RETURNING count
  `;

  if (rows && rows.length > 0) {
    return {
      allowed: true,
      plan: 'free',
      currentCount: rows[0].count,
      limit: FREE_TIER_LIMIT,
    };
  }

  // Quota exceeded: fetch current count for reporting
  const currentRows = await sql`SELECT count FROM usage WHERE user_id = ${userId}`;
  const count = currentRows.length > 0 ? currentRows[0].count : FREE_TIER_LIMIT;

  return {
    allowed: false,
    plan: 'free',
    currentCount: count,
    limit: FREE_TIER_LIMIT,
  };
}

export async function getUserUsage(userId) {
  const rows = await sql`SELECT count, plan FROM usage WHERE user_id = ${userId}`;
  if (rows.length === 0) {
    return { count: 0, plan: 'free', limit: FREE_TIER_LIMIT };
  }
  return {
    count: rows[0].count,
    plan: rows[0].plan,
    limit: rows[0].plan === 'premium' ? Infinity : FREE_TIER_LIMIT,
  };
}

/**
 * Compensating decrement: refunds one quota unit when a provider call fails
 * after quota was already consumed. This ensures users aren't penalized for
 * upstream failures outside their control.
 */
export async function decrementQuota(userId) {
  try {
    await sql`
      UPDATE usage
      SET count = GREATEST(count - 1, 0), updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  } catch (err) {
    // Log but don't throw — refund failure shouldn't crash the error response
    console.error('Quota refund failed:', err.message);
  }
}
