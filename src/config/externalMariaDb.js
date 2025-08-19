import { Sequelize, QueryTypes } from 'sequelize';
import './env.js';

const externalSequelize = new Sequelize(
  process.env.EXT_DB_NAME,
  process.env.EXT_DB_USER,
  process.env.EXT_DB_PASS,
  {
    host: process.env.EXT_DB_HOST,
    port: process.env.EXT_DB_PORT || 3306,
    dialect: 'mysql',
    dialectOptions: {
      // Allow optional SSL for production-like deployments
      ssl:
        String(process.env.EXT_DB_SSL || '').toLowerCase() === 'true'
          ? {
              rejectUnauthorized:
                String(
                  process.env.EXT_DB_SSL_REJECT_UNAUTHORIZED || 'true'
                ).toLowerCase() === 'true',
            }
          : undefined,
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  }
);

// Enforce strict read-only behavior at the connection level.
// Strategy: block known data/DDL mutation operations, allow others (e.g. SET, SHOW, DESCRIBE),
// which are commonly used by the driver during connection/authentication.
const _originalQuery = externalSequelize.query.bind(externalSequelize);
externalSequelize.query = async (sql, options = {}) => {
  const type = options.type;
  const text = typeof sql === 'string' ? sql.trim() : '';
  // Keep original text; avoid unused vars for linters

  // If Sequelize provided a query type, block only the mutating ones.
  const blockedTypes = new Set([
    QueryTypes.INSERT,
    QueryTypes.UPDATE,
    QueryTypes.BULKUPDATE,
    QueryTypes.BULKDELETE,
    QueryTypes.DELETE,
    QueryTypes.UPSERT,
    QueryTypes.TRUNCATE,
  ]);
  if (type != null && blockedTypes.has(type)) {
    const err = new Error('External DB is read-only: write operation blocked');
    err.code = 'EXTERNAL_DB_READ_ONLY';
    throw err;
  }

  // Fallback: simple SQL prefix inspection to block mutations
  // Allow: SELECT/SHOW/DESCRIBE/EXPLAIN/SET/USE/BEGIN/START TRANSACTION/COMMIT/ROLLBACK and comments
  const isAllowedPrefix =
    /^(SELECT|SHOW\s|DESCRIBE|EXPLAIN|SET\s|USE\s|BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK|\/\*)/i.test(
      text
    );
  const isBlockedPrefix =
    /^(INSERT|UPDATE|DELETE|REPLACE|MERGE|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE)\b/i.test(
      text
    );
  if (!isAllowedPrefix && isBlockedPrefix) {
    const err = new Error('External DB is read-only: write operation blocked');
    err.code = 'EXTERNAL_DB_READ_ONLY';
    throw err;
  }

  return _originalQuery(sql, options);
};

// Harden QueryInterface by disabling mutating operations as an extra safety net
const qi = externalSequelize.getQueryInterface();
const block = (name) => {
  // Only override if exists (dialect dependent)
  if (qi[name]) {
    qi[name] = async () => {
      const err = new Error(
        'External DB is read-only: write operation blocked'
      );
      err.code = 'EXTERNAL_DB_READ_ONLY';
      throw err;
    };
  }
};
[
  // Data changes
  'insert',
  'bulkInsert',
  'upsert',
  'update',
  'bulkUpdate',
  'delete',
  'bulkDelete',
  'truncate',
  // DDL changes
  'createTable',
  'dropTable',
  'addColumn',
  'removeColumn',
  'changeColumn',
  'renameColumn',
  'renameTable',
  'addConstraint',
  'removeConstraint',
  'addIndex',
  'removeIndex',
].forEach(block);

let externalDbAvailable = false;

export async function connectExternalMariaDb() {
  const { default: logger } = await import('../../logger.js');
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
    await externalSequelize.authenticate();
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

export async function closeExternalMariaDb() {
  await externalSequelize.close();
}

export default externalSequelize;
