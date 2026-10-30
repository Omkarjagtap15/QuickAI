-- Fix #3: Normalized Likes Table
-- Replaces creations.likes (text[]) with a normalized join table.
-- PRIMARY KEY (creation_id, user_id) guarantees uniqueness and makes like operations idempotent.

CREATE TABLE IF NOT EXISTS likes (
    creation_id INTEGER NOT NULL REFERENCES creations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (creation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_creation_id ON likes(creation_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

-- One-time migration of existing text[] likes data into the likes join table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'creations' AND column_name = 'likes'
    ) THEN
        INSERT INTO likes (creation_id, user_id)
        SELECT c.id, unnest(c.likes)
        FROM creations c
        WHERE array_length(c.likes, 1) > 0
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
