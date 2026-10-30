-- Fix #1: Atomic Quota Metering
-- Replaces Clerk privateMetadata.free_usage with an in-database atomic counter.
-- The core atomic transaction:
-- UPDATE usage SET count = count + 1 WHERE user_id = $1 AND count < $2 RETURNING count

CREATE TABLE IF NOT EXISTS usage (
    user_id TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
