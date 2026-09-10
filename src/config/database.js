'use strict';

const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

let pool;
let pgliteClient = null;

function usePglite() {
  return process.env.USE_PGLITE === '1' || process.env.USE_PGLITE === 'true';
}

function createPool() {
  if (usePglite()) {
    if (!pgliteClient) {
      throw new Error('PGlite client not initialized. Call initPglite() first.');
    }
    const { createPglitePool } = require('./pglite-pool');
    pool = createPglitePool(pgliteClient);
    return pool;
  }

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

async function initPglite() {
  const { PGlite } = require('@electric-sql/pglite');
  pgliteClient = new PGlite();
  await pgliteClient.waitReady;
  createPool();
  return pgliteClient;
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
  pgliteClient = null;
}

module.exports = {
  createPool,
  initPglite,
  getPool,
  query,
  getClient,
  healthCheck,
  close,
};
