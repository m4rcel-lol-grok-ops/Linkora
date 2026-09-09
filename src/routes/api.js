'use strict';

const express = require('express');
const Tweet = require('../models/Tweet');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/users/:username', async (req, res, next) => {
  try {
    const user = await User.findByUsername(req.params.username);
    if (!user || user.is_suspended) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      tweets_count: user.tweets_count,
      following_count: user.following_count,
      followers_count: user.followers_count,
      is_verified: user.is_verified,
      created_at: user.created_at,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/tweets/:id', async (req, res, next) => {
  try {
    const tweet = await Tweet.findById(req.params.id, req.user?.id);
    if (!tweet) return res.status(404).json({ error: 'Not found' });
    res.json(tweet);
  } catch (err) {
    next(err);
  }
});

router.post('/tweets', requireAuth, async (req, res, next) => {
  try {
    const tweet = await Tweet.create({
      userId: req.user.id,
      text: req.body.text,
      replyToId: req.body.reply_to_id,
      replyToUserId: req.body.reply_to_user_id,
    });
    res.status(201).json(tweet);
  } catch (err) {
    next(err);
  }
});

router.post('/tweets/:id/favorite', requireAuth, async (req, res, next) => {
  try {
    const ok = await Tweet.favorite(req.user.id, req.params.id);
    res.json({ ok });
  } catch (err) {
    next(err);
  }
});

router.post('/tweets/:id/retweet', requireAuth, async (req, res, next) => {
  try {
    const result = await Tweet.retweet(req.user.id, req.params.id);
    res.json({ ok: !!result });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:username/follow', requireAuth, async (req, res, next) => {
  try {
    const target = await User.findByUsername(req.params.username);
    if (!target) return res.status(404).json({ error: 'Not found' });
    const ok = await User.follow(req.user.id, target.id);
    res.json({ ok });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
