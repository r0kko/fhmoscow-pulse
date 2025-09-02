import { Sequelize } from 'sequelize';
import './env.js';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    dialectOptions: {
      application_name: 'fhmoscow-pulse',
      statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 60_000),
      idle_in_transaction_session_timeout: Number(
        process.env.DB_IDLE_TX_TIMEOUT_MS || 60_000
      ),
      query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS || 60_000),
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30_000,
      idle: 10_000,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  }
);

/**
 * Try to establish the initial connection.
 * Call this once at app bootstrap (e.g. in app.js) and fail fast on error.
 */
export async function connectToDatabase() {
  const { default: logger } = await import('../../logger.js');
  try {
    await sequelize.authenticate();
    logger.info('✅ DB connection established');
  } catch (error) {
    logger.error('❌ Unable to connect to DB:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown helper.
 * Call from process signal handlers.
 */
export async function closeDatabase() {
  await sequelize.close();
}

export default sequelize;
