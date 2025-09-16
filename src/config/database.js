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
    benchmark: true,
    logging:
      process.env.NODE_ENV === 'development'
        ? (msg, timing) => {
            // Suppress trivial connection pings in dev logs
            if (/SELECT\s+1(\+1)?\s+AS\s+result/i.test(msg)) return;
            if (/^Executing \(default\):\s+SELECT\s+1(\s|;|$)/i.test(msg))
              return;
            console.log(msg, timing ? `(in ${timing} ms)` : '');
          }
        : false,
  }
);

/**
 * Try to establish the initial connection.
 * Call this once at app bootstrap (e.g. in app.js) and fail fast on error.
 */
export async function connectToDatabase() {
  const { default: logger } = await import('../../logger.js');
  try {
    // Patch query to record duration regardless of logging config
    try {
      const originalQuery = sequelize.query.bind(sequelize);
      sequelize.query = async function patchedQuery(sql, options = {}) {
        const started = Date.now();
        const getOp = () => {
          const s = typeof sql === 'string' ? sql : options?.type || '';
          const op = (s?.split?.(/\s+/)?.[0] || '').toUpperCase();
          return /^(SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK)$/.test(
            op
          )
            ? op
            : 'OTHER';
        };
        const operation = getOp();
        try {
          const result = await originalQuery(sql, options);
          import('./metrics.js')
            .then((m) => m.observeDbQuery?.(operation, Date.now() - started))
            .catch(() => {});
          return result;
        } catch (err) {
          import('./metrics.js')
            .then((m) => m.observeDbQuery?.(operation, Date.now() - started))
            .catch(() => {});
          throw err;
        }
      };
    } catch {
      /* ignore */
    }
    await sequelize.authenticate();
    logger.info('✅ DB connection established');
    // Metrics: mark DB up and start pool collector
    try {
      const m = await import('./metrics.js');
      m.setDbUp?.(true);
      m.startSequelizePoolCollector?.(sequelize);
    } catch {
      /* ignore */
    }
  } catch (error) {
    logger.error('❌ Unable to connect to DB:', error);
    try {
      (await import('./metrics.js')).setDbUp?.(false);
    } catch {
      /* ignore */
    }
    const err = new Error('Unable to connect to database');
    err.cause = error;
    throw err;
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
