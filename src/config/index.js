'use strict';

require('dotenv').config();

const path = require('path');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  trustProxy: process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true',

  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'linkora',
    user: process.env.DB_USER || 'linkora',
    password: process.env.DB_PASSWORD || 'linkora_secret',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  session: {
    secret: process.env.SESSION_SECRET || 'dev-only-change-me-in-production-32chars',
    maxAge: parseInt(process.env.SESSION_MAX_AGE_MS || '1209600000', 10), // 14 days
    name: 'linkora.sid',
  },

  upload: {
    dir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads'),
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE || '5242880', 10),
    allowedMime: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
    tweetMax: parseInt(process.env.TWEET_RATE_LIMIT_MAX || '30', 10),
  },

  logLevel: process.env.LOG_LEVEL || 'info',

  reservedUsernames: new Set([
    'admin', 'administrator', 'api', 'login', 'logout', 'register', 'settings',
    'messages', 'notifications', 'search', 'discover', 'home', 'help', 'about',
    'connect', 'compose', 'lists', 'list', 'trends', 'profile', 'profiles',
    'user', 'users', 'tweet', 'tweets', 'status', 'statuses', 'follow',
    'following', 'followers', 'favorites', 'favourite', 'favourites',
    'account', 'accounts', 'password', 'reset', 'verify', 'support',
    'privacy', 'terms', 'tos', 'legal', 'security', 'report', 'reports',
    'block', 'blocks', 'mute', 'mutes', 'media', 'upload', 'uploads',
    'static', 'assets', 'css', 'js', 'img', 'images', 'favicon', 'robots',
    'sitemap', 'health', 'metrics', 'adminpanel', 'moderator', 'mod',
    'www', 'mail', 'email', 'root', 'null', 'undefined',
  ]),
};

if (config.env === 'production' && config.session.secret.includes('change-me')) {
  console.warn('WARNING: SESSION_SECRET is not set to a secure value in production');
}

module.exports = config;
