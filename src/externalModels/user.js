import Joi from 'joi';

import { one, many } from './base.js';

// Example schema; extend as needed. Unknown columns are allowed.
export const userSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  email: Joi.string().email().optional(),
}).unknown(true);

export async function findById(id) {
  return one('SELECT * FROM users WHERE id = ? LIMIT 1', [id], userSchema);
}

export async function findByEmail(email) {
  return one(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email],
    userSchema
  );
}

export async function listUpdatedSince(updatedAt, limit = 100) {
  return many(
    'SELECT * FROM users WHERE updated_at >= ? ORDER BY updated_at ASC LIMIT ?',
    [updatedAt, Number(limit) || 100],
    userSchema
  );
}

export default { findById, findByEmail, listUpdatedSince };
