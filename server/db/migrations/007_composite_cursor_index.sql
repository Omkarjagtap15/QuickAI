-- Fix: Composite keyset cursor index for deterministic pagination
-- Prevents row skipping/duplication when created_at timestamps tie.
-- Covers: WHERE publish = true ORDER BY created_at DESC, id DESC

DROP INDEX IF EXISTS idx_creations_published_feed;

CREATE INDEX IF NOT EXISTS idx_creations_published_feed
ON creations(created_at DESC, id DESC)
WHERE publish = true;
