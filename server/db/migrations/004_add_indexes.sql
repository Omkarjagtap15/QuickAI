-- Fix #3: Performance Indexes for Community Feed & User Queries

-- Partial index for the published community feed
-- Covers WHERE publish = true ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_creations_published_feed 
ON creations(created_at DESC) 
WHERE publish = true;

-- Composite index for user dashboard queries
-- Covers WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_creations_user_created 
ON creations(user_id, created_at DESC);
