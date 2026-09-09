'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const Tweet = require('../models/Tweet');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const config = require('../config');

const router = express.Router();

const tweetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.tweetMax,
  message: 'Tweet rate limit exceeded. Please wait a while.',
});

router.post(
  '/compose',
  requireAuth,
  tweetLimiter,
  body('text').trim().isLength({ min: 1, max: 140 }).withMessage('Tweet must be 1–140 characters'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.session.flash = { type: 'error', message: errors.array()[0].msg };
        return res.redirect(req.get('Referer') || '/home');
      }
      await Tweet.create({
        userId: req.user.id,
        text: req.body.text,
        replyToId: req.body.reply_to_id || null,
        replyToUserId: req.body.reply_to_user_id || null,
      });
      return res.redirect(req.get('Referer') || '/home');
    } catch (err) {
      next(err);
    }
  }
);

router.post('/tweets/:id/favorite', requireAuth, async (req, res, next) => {
  try {
    await Tweet.favorite(req.user.id, req.params.id);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ ok: true });
    }
    return res.redirect(req.get('Referer') || '/home');
  } catch (err) {
    next(err);
  }
});

router.post('/tweets/:id/unfavorite', requireAuth, async (req, res, next) => {
  try {
    await Tweet.unfavorite(req.user.id, req.params.id);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ ok: true });
    }
    return res.redirect(req.get('Referer') || '/home');
  } catch (err) {
    next(err);
  }
});

router.post('/tweets/:id/retweet', requireAuth, async (req, res, next) => {
  try {
    await Tweet.retweet(req.user.id, req.params.id);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ ok: true });
    }
    return res.redirect(req.get('Referer') || '/home');
  } catch (err) {
    next(err);
  }
});

router.post('/tweets/:id/undo-retweet', requireAuth, async (req, res, next) => {
  try {
    await Tweet.undoRetweet(req.user.id, req.params.id);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ ok: true });
    }
    return res.redirect(req.get('Referer') || '/home');
  } catch (err) {
    next(err);
  }
});

router.post('/tweets/:id/delete', requireAuth, async (req, res, next) => {
  try {
    await Tweet.delete(req.user.id, req.params.id);
    return res.redirect(req.get('Referer') || '/home');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
