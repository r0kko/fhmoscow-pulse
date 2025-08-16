import logger from '../../logger.js';
import extDb from '../config/externalMariaDb.js';

/**
 * Execute a parameterized query against the external MariaDB.
 * Always use parameter placeholders (`?`) and `params` to prevent SQL injection.
 */
export async function query(sql, params = []) {
  const started = Date.now();
  try {
    const [rows] = await extDb.query(sql, params);
    return rows;
  } catch (err) {
    logger.error('External DB query failed: %s', err.message, { sql });
    throw err;
  } finally {
    const ms = Date.now() - started;
    if (process.env.NODE_ENV === 'development') {
      logger.debug('External DB query %d ms: %s', ms, summarizeSql(sql));
    }
  }
}

/**
 * Fetch a single row or null. Optionally validate with a Joi schema.
 */
export async function one(sql, params = [], schema) {
  const rows = await query(sql, params);
  const row = rows[0] || null;
  if (row && schema) {
    const { error, value } = schema.validate(row, { allowUnknown: true });
    if (error) {
      logger.warn('External DB row validation failed: %s', error.message);
      return null;
    }
    return value;
  }
  return row;
}

/**
 * Fetch many rows. Optionally validate each row with a Joi schema.
 */
export async function many(sql, params = [], schema) {
  const rows = await query(sql, params);
  if (!schema) return rows;
  const safe = [];
  for (const r of rows) {
    const { error, value } = schema.validate(r, { allowUnknown: true });
    if (error) {
      logger.warn('External DB row validation failed: %s', error.message);
      continue;
    }
    safe.push(value);
  }
  return safe;
}

/**
 * Run a series of queries in a transaction.
 * Usage:
 *   await tx(async (conn) => {
 *     await conn.query('UPDATE ...', [..]);
 *     await conn.query('INSERT ...', [..]);
 *   });
 */
export async function tx(work) {
  const conn = await extDb.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      // ignore rollback error
    }
    logger.error('External DB transaction failed: %s', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

function summarizeSql(sql) {
  const s = String(sql).replace(/\s+/g, ' ').trim();
  return s.length > 200 ? s.slice(0, 197) + '…' : s;
}

export default { query, one, many, tx };
