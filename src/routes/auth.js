'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { requireGuest, requireAuth } = require('../middleware/auth');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/login', requireGuest, (req, res) => {
  res.render('auth/login', { title: 'Log in to Linkora', error: null });
});

router.post(
  '/login',
  requireGuest,
  body('login').trim().notEmpty().withMessage('Username or email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).render('auth/login', {
          title: 'Log in to Linkora',
          error: errors.array()[0].msg,
        });
      }
      const user = await User.authenticate(req.body.login, req.body.password);
      if (!user) {
        logger.warn('Failed login attempt', { login: req.body.login, ip: req.ip });
        return res.status(401).render('auth/login', {
          title: 'Log in to Linkora',
          error: 'Invalid username/email or password',
        });
      }
      req.session.userId = user.id;
      const returnTo = req.session.returnTo || '/home';
      delete req.session.returnTo;
      return res.redirect(returnTo);
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/register', requireGuest, (req, res) => {
  res.render('auth/register', { title: 'Join Linkora', error: null, form: {} });
});

router.post(
  '/register',
  requireGuest,
  body('username')
    .trim()
    .isLength({ min: 1, max: 30 })
    .matches(/^[A-Za-z0-9_]+$/)
    .withMessage('Username may only contain letters, numbers, and underscores'),
  body('display_name').trim().isLength({ min: 1, max: 50 }).withMessage('Display name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).render('auth/register', {
          title: 'Join Linkora',
          error: errors.array()[0].msg,
          form: req.body,
        });
      }
      const { username, display_name, email, password } = req.body;
      if (config.reservedUsernames.has(username.toLowerCase())) {
        return res.status(400).render('auth/register', {
          title: 'Join Linkora',
          error: 'This username is reserved',
          form: req.body,
        });
      }
      const existing = await User.findByUsername(username);
      if (existing) {
        return res.status(400).render('auth/register', {
          title: 'Join Linkora',
          error: 'Username is already taken',
          form: req.body,
        });
      }
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(400).render('auth/register', {
          title: 'Join Linkora',
          error: 'Email is already registered',
          form: req.body,
        });
      }
      const user = await User.create({
        username,
        displayName: display_name,
        email,
        password,
      });
      req.session.userId = user.id;
      logger.info('New user registered', { userId: user.id, username: user.username });
      return res.redirect('/home');
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).render('auth/register', {
          title: 'Join Linkora',
          error: 'Username or email already exists',
          form: req.body,
        });
      }
      return next(err);
    }
  }
);

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) logger.error('Session destroy error', { error: err.message });
    res.clearCookie(config.session.name);
    res.redirect('/');
  });
});

module.exports = router;
