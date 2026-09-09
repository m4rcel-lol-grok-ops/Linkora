'use strict';

const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'linkora' },
  transports: [
    new winston.transports.Console({
      format: config.env === 'development'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
              const extra = Object.keys(meta).length > 1 ? ` ${JSON.stringify(meta)}` : '';
              return `${timestamp} ${level}: ${stack || message}${extra}`;
            })
          )
        : winston.format.json(),
    }),
  ],
});

module.exports = logger;
