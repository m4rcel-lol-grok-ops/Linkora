'use strict';

/**
 * Minimal pg.Pool-compatible wrapper around @electric-sql/pglite.
 * Used when PostgreSQL is not available (local demo / screenshot capture).
 */

function wrapResult(res) {
  const rows = res && res.rows ? res.rows : [];
  return {
    rows,
    rowCount: typeof res?.affectedRows === 'number' ? res.affectedRows : rows.length,
    command: res?.command || '',
    fields: res?.fields || [],
  };
}

function createPglitePool(client) {
  const pool = {
    _client: client,
    async query(text, params) {
      const res = await client.query(text, params || []);
      return wrapResult(res);
    },
    async connect() {
      return {
        query: async (text, params) => wrapResult(await client.query(text, params || [])),
        release() {},
      };
    },
    async end() {
      if (client.close) await client.close();
    },
    on() {
      return pool;
    },
  };
  return pool;
}

module.exports = { createPglitePool };
