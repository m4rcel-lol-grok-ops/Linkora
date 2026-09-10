'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const helmet = require('helmet');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const config = require('./config');
const db = require('./config/database');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/error');
const { attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const homeRoutes = require('./routes/home');
const tweetRoutes = require('./routes/tweets');
const profileRoutes = require('./routes/profile');
const apiRoutes = require('./routes/api');
const searchRoutes = require('./routes/search');
const settingsRoutes = require('./routes/settings');
const connectRoutes = require('./routes/connect');
const discoverRoutes = require('./routes/discover');
const messagesRoutes = require('./routes/messages');

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view cache', config.env === 'production');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

if (config.env !== 'test') {
  app.use(
    morgan(config.env === 'production' ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );
}

app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));

app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    maxAge: config.env === 'production' ? '7d' : 0,
    etag: true,
  })
);

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});
app.use(globalLimiter);

const usePglite = process.env.USE_PGLITE === '1' || process.env.USE_PGLITE === 'true';

const sessionStore = usePglite
  ? new session.MemoryStore()
  : new pgSession({
      pool: db.getPool(),
      tableName: 'session',
      createTableIfMissing: true,
    });

app.use(
  session({
    store: sessionStore,
    name: config.session.name,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: config.session.maxAge,
    },
  })
);

const csrfProtection = csrf({ cookie: false });
app.use((req, res, next) => {
  return csrfProtection(req, res, next);
});

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  res.locals.config = { baseUrl: config.baseUrl, env: config.env };
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.use(attachUser);

app.get('/health', async (req, res) => {
  try {
    await db.healthCheck();
    res.status(200).json({ status: 'ok', service: 'linkora' });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
});

app.use('/', authRoutes);
app.use('/', homeRoutes);
app.use('/', tweetRoutes);
app.use('/messages', messagesRoutes);
app.use('/search', searchRoutes);
app.use('/settings', settingsRoutes);
app.use('/connect', connectRoutes);
app.use('/discover', discoverRoutes);
app.use('/api', apiRoutes);
app.use('/', profileRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
