'use strict';

const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

let pool;

function createPool() {
  const options = config.database.url
    ? { connectionString: config.database.url }
    : {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
      };

  pool = new Pool({
    ...options,
    max: config.database.max,
    idleTimeoutMillis: config.database.idleTimeoutMillis,
    connectionTimeoutMillis: config.database.connectionTimeoutMillis,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected PostgreSQL pool error', { error: err.message });
  });

  return pool;
}

function getPool() {
  if (!pool) {
    createPool();
  }
  return pool;
}

async function query(text, params) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const duration = Date.now() - start;
  if (duration > 200) {
    logger.warn('Slow query', { duration, text: text.substring(0, 120) });
  }
  return res;
}

async function getClient() {
  return getPool().connect();
}

async function healthCheck() {
  const res = await query('SELECT 1 AS ok');
  return res.rows[0].ok === 1;
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  createPool,
  getPool,
  query,
  getClient,
  healthCheck,
  close,
};
