'use strict';

process.env.USE_PGLITE = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '8080';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'linkora-demo-session-secret-not-for-prod';
process.env.BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8080';

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const logger = require('../src/utils/logger');
const { seed } = require('../seeds/run');

async function migrate(client) {
  let sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_initial_schema.sql'), 'utf8');
  sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, '');
  sql = sql.replace(/WITH \(OIDS=FALSE\)/g, '');
  sql = sql.replace(/COLLATE "default"/g, '');
  await client.exec(sql);
}

async function main() {
  const client = await db.initPglite();
  logger.info('PGlite ready, applying schema');
  await migrate(client);
  logger.info('Schema applied, seeding');
  const wrapper = {
    query: (text, params) => db.query(text, params),
    release() {},
  };
  await seed(wrapper);

  const app = require('../src/app');
  const port = parseInt(process.env.PORT, 10);
  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`Linkora demo listening on 0.0.0.0:${port}`);
  });
  return server;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main, migrate };
