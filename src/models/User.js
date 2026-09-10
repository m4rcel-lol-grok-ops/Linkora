'use strict';

const db = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/password');
const config = require('../config');

const User = {
  async findById(id) {
    const { rows } = await db.query(
      `SELECT id, username, display_name, email, bio, location, website,
              avatar_url, header_url, accent_color, background_color,
              is_verified, is_protected, is_suspended, role, email_verified,
              tweets_count, following_count, followers_count, favorites_count,
              lists_count, created_at, last_login_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByUsername(username) {
    const { rows } = await db.query(
      `SELECT id, username, display_name, email, bio, location, website,
              avatar_url, header_url, accent_color, background_color,
              is_verified, is_protected, is_suspended, role, email_verified,
              tweets_count, following_count, followers_count, favorites_count,
              lists_count, created_at, last_login_at
       FROM users WHERE username_lower = $1`,
      [username.toLowerCase()]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const { rows } = await db.query(
      `SELECT * FROM users WHERE email_lower = $1`,
      [email.toLowerCase()]
    );
    return rows[0] || null;
  },

  async create({ username, displayName, email, password }) {
    const lower = username.toLowerCase();
    if (config.reservedUsernames.has(lower)) {
      const err = new Error('This username is reserved');
      err.status = 400;
      throw err;
    }
    const passwordHash = await hashPassword(password);
    const { rows } = await db.query(
      `INSERT INTO users (username, username_lower, display_name, email, email_lower, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, display_name, email, created_at`,
      [username, lower, displayName, email, email.toLowerCase(), passwordHash]
    );
    await db.query(
      `INSERT INTO user_settings (user_id) VALUES ($1)`,
      [rows[0].id]
    );
    return rows[0];
  },

  async authenticate(login, password) {
    const isEmail = login.includes('@');
    const { rows } = await db.query(
      isEmail
        ? `SELECT * FROM users WHERE email_lower = $1`
        : `SELECT * FROM users WHERE username_lower = $1`,
      [login.toLowerCase()]
    );
    const user = rows[0];
    if (!user || user.is_suspended) return null;
    const ok = await verifyPassword(user.password_hash, password);
    if (!ok) return null;
    await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
    return user;
  },

  async updateProfile(id, fields) {
    const allowed = ['display_name', 'bio', 'location', 'website', 'avatar_url', 'header_url', 'accent_color', 'background_color', 'is_protected'];
    const sets = [];
    const values = [];
    let i = 1;
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        values.push(fields[key]);
      }
    }
    if (!sets.length) return this.findById(id);
    sets.push(`updated_at = NOW()`);
    values.push(id);
    const { rows } = await db.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return rows[0];
  },

  async changePassword(id, currentPassword, newPassword) {
    const { rows } = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [id]);
    if (!rows[0]) return false;
    const ok = await verifyPassword(rows[0].password_hash, currentPassword);
    if (!ok) return false;
    const hash = await hashPassword(newPassword);
    await db.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, id]);
    return true;
  },

  async isFollowing(followerId, followingId) {
    const { rows } = await db.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );
    return rows.length > 0;
  },

  async follow(followerId, followingId) {
    if (followerId === followingId) return false;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId]
      );
      if (existing.rows.length) {
        await client.query('ROLLBACK');
        return false;
      }
      const blocked = await client.query(
        `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
        [followerId, followingId]
      );
      if (blocked.rows.length) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
        [followerId, followingId]
      );
      await client.query(`UPDATE users SET following_count = following_count + 1 WHERE id = $1`, [followerId]);
      await client.query(`UPDATE users SET followers_count = followers_count + 1 WHERE id = $1`, [followingId]);
      await client.query(
        `INSERT INTO notifications (user_id, actor_id, type) VALUES ($1, $2, 'follow')`,
        [followingId, followerId]
      );
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async unfollow(followerId, followingId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 RETURNING id`,
        [followerId, followingId]
      );
      if (res.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(`UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = $1`, [followerId]);
      await client.query(`UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = $1`, [followingId]);
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async getFollowers(userId, limit = 20, offset = 0) {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  },

  async getFollowing(userId, limit = 20, offset = 0) {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified
       FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  },

  async whoToFollow(userId, limit = 3) {
    // Simple: users not followed, not self, ordered by follower count
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.bio
       FROM users u
       WHERE u.id <> $1
         AND u.is_suspended = FALSE
         AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1))
       ORDER BY u.followers_count DESC, u.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  },
};

module.exports = User;
