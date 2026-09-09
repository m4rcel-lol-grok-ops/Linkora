'use strict';

const express = require('express');
const Tweet = require('../models/Tweet');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.user) {
    return res.redirect('/home');
  }
  return res.render('auth/landing', { title: 'Linkora' });
});

router.get('/home', requireAuth, async (req, res, next) => {
  try {
    const tweets = await Tweet.homeTimeline(req.user.id, { limit: 20 });
    const suggestions = await User.whoToFollow(req.user.id, 3);
    const { rows: trends } = await db.query(
      `SELECT tag, score FROM trends WHERE location = 'worldwide' ORDER BY rank ASC NULLS LAST, score DESC LIMIT 8`
    );
    // Fallback trends from hashtags if empty
    let trendList = trends;
    if (!trendList.length) {
      const ht = await db.query(
        `SELECT tag, use_count AS score FROM hashtags ORDER BY use_count DESC LIMIT 8`
      );
      trendList = ht.rows;
    }
    res.render('home/index', {
      title: 'Linkora / Home',
      tweets,
      suggestions,
      trends: trendList,
      page: 'home',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
