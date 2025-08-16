import { Sequelize } from 'sequelize';
import './env.js';

const externalSequelize = new Sequelize(
  process.env.EXT_DB_NAME,
  process.env.EXT_DB_USER,
  process.env.EXT_DB_PASS,
  {
    host: process.env.EXT_DB_HOST,
    port: process.env.EXT_DB_PORT || 3306,
    dialect: 'mysql',
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  }
);

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
