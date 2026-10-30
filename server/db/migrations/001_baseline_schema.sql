-- Baseline schema: the original creations table as inferred from v1 application code
-- This represents the v1-baseline state before any architectural optimizations.

CREATE TABLE IF NOT EXISTS creations (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('article', 'blog-title', 'image', 'resume-review')),
    publish BOOLEAN DEFAULT FALSE,
    likes TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NOTE: In v1-baseline, no indexes exist beyond the primary key.
-- NOTE: 'likes' is stored as a text array, leading to lost updates under concurrency.
-- NOTE: Free-tier quota was tracked via Clerk private metadata without row-level atomicity.
