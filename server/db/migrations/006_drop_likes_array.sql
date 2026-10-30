-- Fix #3: Drop deprecated text[] likes column after data migration verification
-- Run only once the new likes join table is verified in production.

ALTER TABLE creations DROP COLUMN IF EXISTS likes;
