import sql from '../configs/db.js';

/**
 * High-Performance User & Community Feed Controller
 *
 * Optimizations:
 * 1. Normalized likes: atomic toggle via INSERT ... ON CONFLICT DO NOTHING / DELETE
 *    Eliminates read-modify-write lost updates under concurrency.
 * 2. Keyset pagination for community feed (replaces full unindexed table scans).
 * 3. SQL aggregation for like counts and user like status.
 */

export const getUserCreations = async (req, res) => {
  try {
    const userId = req.userId;

    const creations = await sql`
      SELECT c.*,
             COALESCE(ARRAY_AGG(l.user_id) FILTER (WHERE l.user_id IS NOT NULL), '{}') AS likes,
             COUNT(l.user_id)::int AS like_count
      FROM creations c
      LEFT JOIN likes l ON c.id = l.creation_id
      WHERE c.user_id = ${userId}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;

    res.json({ success: true, creations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublishedCreations = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const cursor = req.query.cursor ? new Date(req.query.cursor).toISOString() : null;

    let creations;
    if (cursor) {
      creations = await sql`
        SELECT c.*,
               COALESCE(ARRAY_AGG(l.user_id) FILTER (WHERE l.user_id IS NOT NULL), '{}') AS likes,
               COUNT(l.user_id)::int AS like_count,
               BOOL_OR(l.user_id = ${userId}) AS is_liked
        FROM creations c
        LEFT JOIN likes l ON c.id = l.creation_id
        WHERE c.publish = true AND c.created_at < ${cursor}::timestamp
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      creations = await sql`
        SELECT c.*,
               COALESCE(ARRAY_AGG(l.user_id) FILTER (WHERE l.user_id IS NOT NULL), '{}') AS likes,
               COUNT(l.user_id)::int AS like_count,
               BOOL_OR(l.user_id = ${userId}) AS is_liked
        FROM creations c
        LEFT JOIN likes l ON c.id = l.creation_id
        WHERE c.publish = true
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT ${limit}
      `;
    }

    const nextCursor =
      creations.length === limit ? creations[creations.length - 1].created_at : null;

    res.json({
      success: true,
      creations,
      nextCursor,
      hasMore: Boolean(nextCursor),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleLikeCreation = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Creation ID is required' });
    }

    // Check creation existence
    const creations = await sql`SELECT id FROM creations WHERE id = ${id}`;
    if (creations.length === 0) {
      return res.status(404).json({ success: false, message: 'Creation not found' });
    }

    // Atomic insert: if conflict (already liked), row will not be returned
    const insertRes = await sql`
      INSERT INTO likes (creation_id, user_id)
      VALUES (${id}, ${userId})
      ON CONFLICT (creation_id, user_id) DO NOTHING
      RETURNING *
    `;

    let message;
    let isLiked;

    if (insertRes && insertRes.length > 0) {
      // Newly liked
      message = 'Creation Liked';
      isLiked = true;
    } else {
      // Already liked, so toggle to unliked
      await sql`
        DELETE FROM likes
        WHERE creation_id = ${id} AND user_id = ${userId}
      `;
      message = 'Creation Unliked';
      isLiked = false;
    }

    // Fetch current total count
    const countRes = await sql`SELECT COUNT(*)::int AS count FROM likes WHERE creation_id = ${id}`;
    const totalLikes = countRes[0]?.count || 0;

    res.json({
      success: true,
      message,
      isLiked,
      totalLikes,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
