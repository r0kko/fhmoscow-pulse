import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_PATTERN,
} from '../config/auth.js';

// A small curated set of very common weak passwords and patterns.
// Keep list short to avoid overhead; do not attempt to be exhaustive.
const COMMON_WEAK = new Set([
  'password',
  '123456',
  '12345678',
  '123456789',
  '111111',
  '000000',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  '1q2w3e4r',
  'abc123',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'iloveyou',
  'admin',
]);

function hasWhitespace(str) {
  return /\s/.test(str);
}

function isAllSameChar(str) {
  if (!str || str.length < 3) return false;
  return /^(.)(\1)+$/.test(str);
}

// Detect if the entire password is a simple straight keyboard/alpha/numeric sequence
function isSimpleSequence(str) {
  const s = String(str || '').toLowerCase();
  if (s.length < 6) return false; // consider only long sequences
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    'qwertyuiopasdfghjklzxcvbnm',
    '0123456789',
  ];
  for (const base of sequences) {
    if (base.includes(s) || base.split('').reverse().join('').includes(s)) {
      return true;
    }
  }
  return false;
}

export function validatePassword(password) {
  if (typeof password !== 'string') return false;
  if (hasWhitespace(password)) return false;
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  )
    return false;
  if (!PASSWORD_PATTERN.test(password)) return false;
  const lower = password.toLowerCase();
  if (COMMON_WEAK.has(lower)) return false;
  if (isAllSameChar(password)) return false;
  return !isSimpleSequence(password);
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
