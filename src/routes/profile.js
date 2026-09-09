'use strict';

const express = require('express');
const User = require('../models/User');
const Tweet = require('../models/Tweet');
const { requireAuth } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

router.post('/:username/follow', requireAuth, async (req, res, next) => {
  try {
    const target = await User.findByUsername(req.params.username);
    if (!target) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    await User.follow(req.user.id, target.id);
    return res.redirect(req.get('Referer') || `/${target.username}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:username/unfollow', requireAuth, async (req, res, next) => {
  try {
    const target = await User.findByUsername(req.params.username);
    if (!target) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    await User.unfollow(req.user.id, target.id);
    return res.redirect(req.get('Referer') || `/${target.username}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:username/followers', async (req, res, next) => {
  try {
    const user = await User.findByUsername(req.params.username);
    if (!user || user.is_suspended) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    const followers = await User.getFollowers(user.id, 50);
    res.render('profile/followers', {
      title: `People following ${user.display_name}`,
      profileUser: user,
      users: followers,
      page: 'followers',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:username/following', async (req, res, next) => {
  try {
    const user = await User.findByUsername(req.params.username);
    if (!user || user.is_suspended) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    const following = await User.getFollowing(user.id, 50);
    res.render('profile/following', {
      title: `People followed by ${user.display_name}`,
      profileUser: user,
      users: following,
      page: 'following',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:username/status/:id', async (req, res, next) => {
  try {
    const tweet = await Tweet.findById(req.params.id, req.user?.id);
    if (!tweet || tweet.username.toLowerCase() !== req.params.username.toLowerCase()) {
      const err = new Error('Tweet not found');
      err.status = 404;
      throw err;
    }
    res.render('profile/status', {
      title: `${tweet.display_name} on Linkora: "${tweet.text.substring(0, 50)}"`,
      tweet,
      page: 'status',
    });
  } catch (err) {
    next(err);
  }
});

// Profile page (must be last among /:username routes)
router.get('/:username', async (req, res, next) => {
  try {
    // Guard against system routes colliding (Express order should prevent most)
    const reserved = require('../config').reservedUsernames;
    if (reserved.has(req.params.username.toLowerCase())) {
      return next();
    }
    const user = await User.findByUsername(req.params.username);
    if (!user || user.is_suspended) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    const isOwn = req.user && req.user.id === user.id;
    let isFollowing = false;
    if (req.user && !isOwn) {
      isFollowing = await User.isFollowing(req.user.id, user.id);
    }
    // Protected account check
    if (user.is_protected && !isOwn && !isFollowing) {
      return res.render('profile/protected', {
        title: `${user.display_name} (@${user.username})`,
        profileUser: user,
        isFollowing,
        page: 'profile',
      });
    }
    const tweets = await Tweet.userTimeline(user.id, { limit: 20 });
    let pinned = null;
    const pinRes = await db.query(
      `SELECT t.*, u.username, u.display_name, u.avatar_url, u.is_verified
       FROM pinned_tweets p
       JOIN tweets t ON t.id = p.tweet_id
       JOIN users u ON u.id = t.user_id
       WHERE p.user_id = $1 AND t.deleted_at IS NULL`,
      [user.id]
    );
    if (pinRes.rows[0]) pinned = pinRes.rows[0];

    res.render('profile/show', {
      title: `${user.display_name} (@${user.username})`,
      profileUser: user,
      tweets,
      pinned,
      isOwn,
      isFollowing,
      page: 'profile',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
