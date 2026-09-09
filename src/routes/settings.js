'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => res.redirect('/settings/account'));

router.get('/account', (req, res) => {
  res.render('settings/account', { title: 'Account settings', page: 'settings', section: 'account' });
});

router.get('/profile', (req, res) => {
  res.render('settings/profile', { title: 'Profile settings', page: 'settings', section: 'profile', form: req.user });
});

router.post(
  '/profile',
  body('display_name').trim().isLength({ min: 1, max: 50 }),
  body('bio').optional().trim().isLength({ max: 160 }),
  body('location').optional().trim().isLength({ max: 100 }),
  body('website').optional().trim().isLength({ max: 200 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).render('settings/profile', {
          title: 'Profile settings',
          page: 'settings',
          section: 'profile',
          form: req.body,
          error: errors.array()[0].msg,
        });
      }
      await User.updateProfile(req.user.id, {
        display_name: req.body.display_name,
        bio: req.body.bio || '',
        location: req.body.location || '',
        website: req.body.website || '',
      });
      req.session.flash = { type: 'success', message: 'Profile updated' };
      res.redirect('/settings/profile');
    } catch (err) {
      next(err);
    }
  }
);

router.get('/password', (req, res) => {
  res.render('settings/password', { title: 'Password settings', page: 'settings', section: 'password' });
});

router.post(
  '/password',
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 }),
  async (req, res, next) => {
    try {
      const ok = await User.changePassword(req.user.id, req.body.current_password, req.body.new_password);
      if (!ok) {
        return res.status(400).render('settings/password', {
          title: 'Password settings',
          page: 'settings',
          section: 'password',
          error: 'Current password is incorrect',
        });
      }
      req.session.flash = { type: 'success', message: 'Password changed' };
      res.redirect('/settings/password');
    } catch (err) {
      next(err);
    }
  }
);

router.get('/privacy', (req, res) => {
  res.render('settings/privacy', { title: 'Privacy settings', page: 'settings', section: 'privacy' });
});

router.get('/design', (req, res) => {
  res.render('settings/design', { title: 'Design settings', page: 'settings', section: 'design' });
});

module.exports = router;
