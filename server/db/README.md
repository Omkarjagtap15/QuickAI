# QuickAI Database Architecture & Migration Engine

This directory provides schema evolution management, indexes, and benchmark seed scripts for QuickAI's PostgreSQL database.

---

## Migration Changelog

- `001_baseline_schema.sql`: Snapshot of the original v1 creations table.
- `002_add_usage_table.sql`: Introduces atomic quota metering table to replace Clerk metadata read-modify-write.
- `003_normalize_likes.sql`: Converts `creations.likes` (`text[]`) into a normalized `likes` join table with `PRIMARY KEY (creation_id, user_id)` to eliminate race conditions and lost updates.
- `004_add_indexes.sql`: Partial indexes for published feed (`WHERE publish = true ORDER BY created_at DESC`) and composite indexes for user queries.
- `005_add_jobs_table.sql`: Persistent job tracking for BullMQ background workers and SSE client subscriptions.
- `006_drop_likes_array.sql`: Safely drops the deprecated `likes` array column from `creations`.

---

## Execution

```bash
# Run all pending migrations
npm run db:migrate

# Seed sample records for benchmarking
npm run db:seed
```
