'use strict';

const db = require('../config/database');

const Tweet = {
  async create({ userId, text, replyToId = null, replyToUserId = null, mediaUrls = [], mediaTypes = [] }) {
    if (!text || text.length === 0 || text.length > 140) {
      const err = new Error('Tweet must be between 1 and 140 characters');
      err.status = 400;
      throw err;
    }
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO tweets (user_id, text, reply_to_id, reply_to_user_id, media_urls, media_types)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, text, replyToId, replyToUserId, mediaUrls, mediaTypes]
      );
      await client.query(`UPDATE users SET tweets_count = tweets_count + 1 WHERE id = $1`, [userId]);
      if (replyToId) {
        await client.query(`UPDATE tweets SET replies_count = replies_count + 1 WHERE id = $1`, [replyToId]);
        if (replyToUserId && replyToUserId !== userId) {
          await client.query(
            `INSERT INTO notifications (user_id, actor_id, type, tweet_id) VALUES ($1, $2, 'reply', $3)`,
            [replyToUserId, userId, rows[0].id]
          );
        }
      }
      // Extract hashtags
      const tags = text.match(/#(\w+)/g) || [];
      for (const raw of tags) {
        const tag = raw.slice(1);
        const tagLower = tag.toLowerCase();
        let ht = await client.query(`SELECT id FROM hashtags WHERE tag_lower = $1`, [tagLower]);
        if (!ht.rows[0]) {
          ht = await client.query(
            `INSERT INTO hashtags (tag, tag_lower, use_count) VALUES ($1, $2, 1) RETURNING id`,
            [tag, tagLower]
          );
        } else {
          await client.query(`UPDATE hashtags SET use_count = use_count + 1 WHERE id = $1`, [ht.rows[0].id]);
        }
        await client.query(
          `INSERT INTO tweet_hashtags (tweet_id, hashtag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [rows[0].id, ht.rows[0].id]
        );
      }
      // Mentions notifications
      const mentions = text.match(/@(\w+)/g) || [];
      for (const m of mentions) {
        const uname = m.slice(1).toLowerCase();
        const u = await client.query(`SELECT id FROM users WHERE username_lower = $1`, [uname]);
        if (u.rows[0] && u.rows[0].id !== userId) {
          await client.query(
            `INSERT INTO notifications (user_id, actor_id, type, tweet_id) VALUES ($1, $2, 'mention', $3)`,
            [u.rows[0].id, userId, rows[0].id]
          );
        }
      }
      await client.query('COMMIT');
      return rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async findById(id, viewerId = null) {
    const { rows } = await db.query(
      `SELECT t.*, u.username, u.display_name, u.avatar_url, u.is_verified,
              ot.user_id AS original_user_id,
              ou.username AS original_username, ou.display_name AS original_display_name,
              ou.avatar_url AS original_avatar_url, ou.is_verified AS original_is_verified
       FROM tweets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN tweets ot ON ot.id = t.original_tweet_id
       LEFT JOIN users ou ON ou.id = ot.user_id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [id]
    );
    if (!rows[0]) return null;
    const tweet = rows[0];
    if (viewerId) {
      const fav = await db.query(`SELECT 1 FROM favorites WHERE user_id = $1 AND tweet_id = $2`, [viewerId, id]);
      tweet.favorited = fav.rows.length > 0;
      const rt = await db.query(`SELECT 1 FROM retweets WHERE user_id = $1 AND tweet_id = $2`, [viewerId, id]);
      tweet.retweeted = rt.rows.length > 0;
    }
    return tweet;
  },

  async homeTimeline(userId, { limit = 20, cursor = null } = {}) {
    // Reverse chronological from followed users + self, excluding muted/blocked
    let sql = `
      SELECT t.*, u.username, u.display_name, u.avatar_url, u.is_verified,
             CASE WHEN f.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS favorited,
             CASE WHEN r.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS retweeted,
             rt_user.username AS retweeter_username, rt_user.display_name AS retweeter_display_name
      FROM tweets t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN favorites f ON f.tweet_id = t.id AND f.user_id = $1
      LEFT JOIN retweets r ON r.tweet_id = t.id AND r.user_id = $1
      LEFT JOIN retweets rt ON rt.tweet_id = t.id AND rt.user_id <> t.user_id
      LEFT JOIN users rt_user ON rt_user.id = rt.user_id
      WHERE t.deleted_at IS NULL
        AND (
          t.user_id = $1
          OR EXISTS (SELECT 1 FROM follows fl WHERE fl.follower_id = $1 AND fl.following_id = t.user_id)
          OR EXISTS (SELECT 1 FROM retweets rtx WHERE rtx.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1) AND rtx.tweet_id = t.id)
        )
        AND NOT EXISTS (SELECT 1 FROM mutes m WHERE m.muter_id = $1 AND m.muted_id = t.user_id)
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = t.user_id) OR (b.blocker_id = t.user_id AND b.blocked_id = $1))
    `;
    const params = [userId];
    if (cursor) {
      params.push(cursor);
      sql += ` AND t.created_at < $${params.length}`;
    }
    params.push(limit);
    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length}`;
    const { rows } = await db.query(sql, params);
    return rows;
  },

  async userTimeline(userId, { limit = 20, cursor = null, includeReplies = false } = {}) {
    let sql = `
      SELECT t.*, u.username, u.display_name, u.avatar_url, u.is_verified
      FROM tweets t
      JOIN users u ON u.id = t.user_id
      WHERE t.user_id = $1 AND t.deleted_at IS NULL
    `;
    const params = [userId];
    if (!includeReplies) {
      sql += ` AND t.reply_to_id IS NULL`;
    }
    if (cursor) {
      params.push(cursor);
      sql += ` AND t.created_at < $${params.length}`;
    }
    params.push(limit);
    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length}`;
    const { rows } = await db.query(sql, params);
    return rows;
  },

  async favorite(userId, tweetId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO favorites (user_id, tweet_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING id`,
        [userId, tweetId]
      );
      if (ins.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(`UPDATE tweets SET favorites_count = favorites_count + 1 WHERE id = $1`, [tweetId]);
      await client.query(`UPDATE users SET favorites_count = favorites_count + 1 WHERE id = $1`, [userId]);
      const t = await client.query(`SELECT user_id FROM tweets WHERE id = $1`, [tweetId]);
      if (t.rows[0] && t.rows[0].user_id !== userId) {
        await client.query(
          `INSERT INTO notifications (user_id, actor_id, type, tweet_id) VALUES ($1, $2, 'favorite', $3)`,
          [t.rows[0].user_id, userId, tweetId]
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async unfavorite(userId, tweetId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const del = await client.query(
        `DELETE FROM favorites WHERE user_id = $1 AND tweet_id = $2 RETURNING id`,
        [userId, tweetId]
      );
      if (del.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(`UPDATE tweets SET favorites_count = GREATEST(favorites_count - 1, 0) WHERE id = $1`, [tweetId]);
      await client.query(`UPDATE users SET favorites_count = GREATEST(favorites_count - 1, 0) WHERE id = $1`, [userId]);
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async retweet(userId, tweetId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const original = await client.query(`SELECT * FROM tweets WHERE id = $1 AND deleted_at IS NULL`, [tweetId]);
      if (!original.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const ins = await client.query(
        `INSERT INTO retweets (user_id, tweet_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING id`,
        [userId, tweetId]
      );
      if (ins.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(`UPDATE tweets SET retweets_count = retweets_count + 1 WHERE id = $1`, [tweetId]);
      // Create a retweet "tweet" entry for timeline
      const { rows } = await client.query(
        `INSERT INTO tweets (user_id, text, is_retweet, original_tweet_id)
         VALUES ($1, $2, TRUE, $3) RETURNING *`,
        [userId, original.rows[0].text, tweetId]
      );
      await client.query(`UPDATE users SET tweets_count = tweets_count + 1 WHERE id = $1`, [userId]);
      if (original.rows[0].user_id !== userId) {
        await client.query(
          `INSERT INTO notifications (user_id, actor_id, type, tweet_id) VALUES ($1, $2, 'retweet', $3)`,
          [original.rows[0].user_id, userId, tweetId]
        );
      }
      await client.query('COMMIT');
      return rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async undoRetweet(userId, tweetId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const del = await client.query(
        `DELETE FROM retweets WHERE user_id = $1 AND tweet_id = $2 RETURNING id`,
        [userId, tweetId]
      );
      if (del.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(`UPDATE tweets SET retweets_count = GREATEST(retweets_count - 1, 0) WHERE id = $1`, [tweetId]);
      await client.query(
        `UPDATE tweets SET deleted_at = NOW() WHERE user_id = $1 AND original_tweet_id = $2 AND is_retweet = TRUE`,
        [userId, tweetId]
      );
      await client.query(`UPDATE users SET tweets_count = GREATEST(tweets_count - 1, 0) WHERE id = $1`, [userId]);
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async delete(userId, tweetId) {
    const { rows } = await db.query(
      `UPDATE tweets SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id`,
      [tweetId, userId]
    );
    if (rows[0]) {
      await db.query(`UPDATE users SET tweets_count = GREATEST(tweets_count - 1, 0) WHERE id = $1`, [userId]);
    }
    return !!rows[0];
  },

  async search(q, { limit = 20 } = {}) {
    const { rows } = await db.query(
      `SELECT t.*, u.username, u.display_name, u.avatar_url, u.is_verified
       FROM tweets t
       JOIN users u ON u.id = t.user_id
       WHERE t.deleted_at IS NULL AND t.text ILIKE $1
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [`%${q}%`, limit]
    );
    return rows;
  },
};

module.exports = Tweet;
