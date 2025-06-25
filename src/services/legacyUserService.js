import legacyDb from '../config/legacyDatabase.js';

export async function findByEmail(email) {
  const [rows] = await legacyDb.query(
    'SELECT * FROM a_player WHERE e_mail = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

export async function findById(id) {
  const [rows] = await legacyDb.query(
    'SELECT * FROM a_player WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

export default { findByEmail, findById };
