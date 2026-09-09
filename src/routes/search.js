'use strict';

const express = require('express');
const Tweet = require('../models/Tweet');
const User = require('../models/User');
const db = require('../config/database');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    let tweets = [];
    let users = [];
    if (q) {
      tweets = await Tweet.search(q, { limit: 20 });
      const { rows } = await db.query(
        `SELECT id, username, display_name, avatar_url, bio, is_verified, followers_count
         FROM users
         WHERE username_lower ILIKE $1 OR display_name ILIKE $1
         LIMIT 10`,
        [`%${q.toLowerCase()}%`]
      );
      users = rows;
    }
    res.render('search/index', {
      title: q ? `Linkora Search - ${q}` : 'Search Linkora',
      q,
      tweets,
      users,
      page: 'search',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
