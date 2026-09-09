'use strict';

const express = require('express');
const User = require('../models/User');
const db = require('../config/database');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const suggestions = req.user
      ? await User.whoToFollow(req.user.id, 10)
      : (
          await db.query(
            `SELECT id, username, display_name, avatar_url, bio, is_verified, followers_count
             FROM users WHERE is_suspended = FALSE ORDER BY followers_count DESC LIMIT 10`
          )
        ).rows;

    const { rows: popular } = await db.query(
      `SELECT t.*, u.username, u.display_name, u.avatar_url, u.is_verified
       FROM tweets t JOIN users u ON u.id = t.user_id
       WHERE t.deleted_at IS NULL
       ORDER BY (t.favorites_count + t.retweets_count) DESC, t.created_at DESC
       LIMIT 10`
    );

    const { rows: trends } = await db.query(
      `SELECT tag, use_count AS score FROM hashtags ORDER BY use_count DESC LIMIT 10`
    );

    res.render('discover/index', {
      title: 'Discover',
      suggestions,
      popular,
      trends,
      page: 'discover',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
