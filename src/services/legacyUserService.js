import legacyDb, { isLegacyDbAvailable } from '../config/legacyDatabase.js';
import logger from '../../logger.js';

export async function findByEmail(email) {
  if (!isLegacyDbAvailable()) return null;
  try {
    const [rows] = await legacyDb.query(
      'SELECT * FROM a_player WHERE e_mail = ? LIMIT 1',
      [email]
    );
    return rows[0] || null;
  } catch (err) {
    logger.error('Legacy DB query failed: %s', err.message);
    return null;
  }
}

export async function findById(id) {
  if (!isLegacyDbAvailable()) return null;
  try {
    const [rows] = await legacyDb.query(
      'SELECT * FROM a_player WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    logger.error('Legacy DB query failed: %s', err.message);
    return null;
  }
}

export default { findByEmail, findById };
