'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.render('messages/index', {
    title: 'Direct Messages',
    page: 'messages',
    conversations: [],
  });
});

module.exports = router;
