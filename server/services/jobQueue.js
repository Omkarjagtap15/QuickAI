import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import sql from '../configs/db.js';
import { logger } from './logger.js';

export const jobEvents = new EventEmitter();
// Allow multiple SSE client listeners
jobEvents.setMaxListeners(100);

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dispatches an asynchronous job with retry and backoff logic.
 * Saves job progress to PostgreSQL `jobs` table and publishes SSE events.
 */
export async function enqueueJob({ userId, type, input, processor }) {
  const jobId = `job_${randomUUID()}`;

  // 1. Persist initial pending state
  await sql`
    INSERT INTO jobs (id, user_id, type, status, input)
    VALUES (${jobId}, ${userId}, ${type}, 'pending', ${JSON.stringify(input)})
  `;

  logger.info({ event: 'job_enqueued', jobId, userId, type });

  // 2. Process in background without blocking the HTTP response
  setImmediate(() => {
    executeJobWithRetry({ jobId, userId, type, input, processor }).catch((err) => {
      logger.error({ event: 'job_unhandled_error', jobId, error: err.message });
    });
  });

  return { jobId, status: 'pending' };
}

async function executeJobWithRetry({ jobId, userId, type, input, processor }) {
  let attempt = 0;
  let backoff = INITIAL_BACKOFF_MS;

  await sql`
    UPDATE jobs
    SET status = 'processing', updated_at = NOW()
    WHERE id = ${jobId}
  `;
  jobEvents.emit(`job:${jobId}`, { jobId, status: 'processing' });

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      logger.info({ event: 'job_attempt_start', jobId, attempt });

      const result = await processor(input);

      // Save success
      await sql`
        UPDATE jobs
        SET status = 'completed', result = ${JSON.stringify(result)}, attempts = ${attempt}, updated_at = NOW()
        WHERE id = ${jobId}
      `;

      logger.info({ event: 'job_completed', jobId, attempts: attempt });
      jobEvents.emit(`job:${jobId}`, { jobId, status: 'completed', result });
      return;
    } catch (err) {
      logger.warn({ event: 'job_attempt_failed', jobId, attempt, error: err.message });

      if (attempt >= MAX_RETRIES) {
        // Mark failed after exhausting retries
        await sql`
          UPDATE jobs
          SET status = 'failed', error = ${err.message}, attempts = ${attempt}, updated_at = NOW()
          WHERE id = ${jobId}
        `;
        jobEvents.emit(`job:${jobId}`, { jobId, status: 'failed', error: err.message });
        return;
      }

      await delay(backoff);
      backoff *= 2; // Exponential backoff
    }
  }
}

export async function getJobById(jobId, userId) {
  const rows = await sql`
    SELECT * FROM jobs
    WHERE id = ${jobId} AND user_id = ${userId}
  `;
  return rows.length > 0 ? rows[0] : null;
}
