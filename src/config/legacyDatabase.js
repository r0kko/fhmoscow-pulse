import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const legacyPool = mysql.createPool({
  host: process.env.LEGACY_DB_HOST,
  port: process.env.LEGACY_DB_PORT || 3306,
  user: process.env.LEGACY_DB_USER,
  password: process.env.LEGACY_DB_PASS,
  database: process.env.LEGACY_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

export async function connectLegacyDatabase() {
  try {
    await legacyPool.query('SELECT 1');
    console.log('✅ Legacy DB connection established');
  } catch (err) {
    console.error('❌ Unable to connect to legacy DB:', err);
    process.exit(1);
  }
}

export default legacyPool;
