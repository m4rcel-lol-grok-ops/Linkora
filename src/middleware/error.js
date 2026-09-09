'use strict';

const logger = require('../utils/logger');

function notFound(req, res, next) {
  res.status(404);
  if (req.accepts('html')) {
    return res.render('errors/404', {
      title: 'Page not found',
      layout: false,
    });
  }
  return res.json({ error: 'Not found' });
}

function errorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn('CSRF token invalid', { path: req.path, ip: req.ip });
    res.status(403);
    if (req.accepts('html')) {
      return res.render('errors/403', { title: 'Forbidden', message: 'Invalid security token. Please go back and try again.' });
    }
    return res.json({ error: 'Invalid CSRF token' });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    logger.error('Server error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  res.status(status);
  if (req.accepts('html')) {
    if (status === 403) {
      return res.render('errors/403', { title: 'Forbidden', message: err.message || 'You do not have permission to view this page.' });
    }
    if (status === 429) {
      return res.render('errors/429', { title: 'Too many requests' });
    }
    return res.render('errors/500', {
      title: 'Something went wrong',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    });
  }
  return res.json({
    error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

module.exports = { notFound, errorHandler };
