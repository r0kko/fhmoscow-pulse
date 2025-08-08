import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '../config/auth.js';

export function validatePassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < PASSWORD_MIN_LENGTH) return false;
  if (!PASSWORD_PATTERN.test(password)) return false;
  const common = ['password', '123456', 'qwerty'];
  if (common.includes(password.toLowerCase())) return false;
  return true;
}

export function assertPassword(password) {
  if (!validatePassword(password)) {
    const err = new Error('weak_password');
    err.status = 400;
    throw err;
  }
}

export default {
  validatePassword,
  assertPassword,
};
