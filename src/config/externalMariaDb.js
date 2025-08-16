import mysql from 'mysql2/promise';
import './env.js';

const externalPool = mysql.createPool({
  host: process.env.EXT_DB_HOST,
  port: process.env.EXT_DB_PORT || 3306,
  user: process.env.EXT_DB_USER,
  password: process.env.EXT_DB_PASS,
  database: process.env.EXT_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 5000,
});

let externalDbAvailable = false;

export async function connectExternalMariaDb() {
  const { default: logger } = await import('../../logger.js');
  // Allow running without EXT_* configured; skip probing if missing
  if (
    !process.env.EXT_DB_HOST ||
    !process.env.EXT_DB_USER ||
    !process.env.EXT_DB_NAME
  ) {
    logger.info('EXT_* env not set; skipping external MariaDB connection');
    externalDbAvailable = false;
    return;
  }
  try {
    await externalPool.query('SELECT 1');
    externalDbAvailable = true;
    logger.info('✅ External MariaDB connection established');
  } catch (err) {
    externalDbAvailable = false;
    logger.warn('⚠️ Unable to connect to external MariaDB: %s', err.message);
  }
}

export function isExternalDbAvailable() {
  return externalDbAvailable;
}

export default externalPool;
