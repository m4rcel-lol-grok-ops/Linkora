'use strict';

const db = require('../config/database');

async function attachUser(req, res, next) {
  res.locals.currentUser = null;
  if (!req.session || !req.session.userId) {
    return next();
  }
  try {
    const { rows } = await db.query(
      `SELECT id, username, display_name, email, avatar_url, header_url,
              accent_color, is_verified, is_protected, is_suspended, role,
              tweets_count, following_count, followers_count, favorites_count
       FROM users WHERE id = $1 AND is_suspended = FALSE`,
      [req.session.userId]
    );
    if (rows[0]) {
      req.user = rows[0];
      res.locals.currentUser = rows[0];
    } else {
      req.session.destroy(() => {});
    }
  } catch (err) {
    return next(err);
  }
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  return next();
}

function requireGuest(req, res, next) {
  if (req.user) {
    return res.redirect('/home');
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const err = new Error('Forbidden');
      err.status = 403;
      return next(err);
    }
    return next();
  };
}

module.exports = { attachUser, requireAuth, requireGuest, requireRole };
