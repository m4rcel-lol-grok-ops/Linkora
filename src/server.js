'use strict';

const app = require('./app');
const config = require('./config');
const db = require('./config/database');
const logger = require('./utils/logger');

const server = app.listen(config.port, () => {
  logger.info(`Linkora listening on port ${config.port} (${config.env})`);
});

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    try {
      await db.close();
      logger.info('Database pool closed');
    } catch (err) {
      logger.error('Error closing database', { error: err.message });
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
