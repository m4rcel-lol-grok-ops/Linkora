'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows: notifications } = await db.query(
      `SELECT n.*, u.username AS actor_username, u.display_name AS actor_display_name, u.avatar_url AS actor_avatar
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    await db.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, [req.user.id]);
    res.render('connect/index', {
      title: 'Connect',
      notifications,
      page: 'connect',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
