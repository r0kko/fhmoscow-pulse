import crypto from 'crypto';

import '../config/env.js';

export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
export const EMAIL_CODE_COOLDOWN_MS = 15 * 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

function getSecret() {
  return (
    process.env.EMAIL_CODE_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    ''
  );
}

function safeBuffer(hex) {
  try {
    return Buffer.from(String(hex || ''), 'hex');
  } catch {
    return Buffer.alloc(0);
  }
}

export function normalizeEmailCodePurpose(raw = 'verify') {
  const value = String(raw || 'verify')
    .trim()
    .toLowerCase();
  if (!value) return 'verify';
  return value.replace(/-/g, '_');
}

export function normalizeEmailCodeInput(code) {
  return String(code || '')
    .replace(/\D+/g, '')
    .slice(0, 6);
}

export function generateSixDigitCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashEmailCode({ code, recordId, userId, purpose = 'verify' }) {
  const secret = getSecret();
  if (!secret) throw new Error('EMAIL_CODE_SECRET is not configured');
  const normalizedPurpose = normalizeEmailCodePurpose(purpose);
  const normalizedCode = normalizeEmailCodeInput(code);
  const payload = `${normalizedPurpose}:${userId}:${recordId}:${normalizedCode}`;
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

export function verifyEmailCodeHash(
  expectedHash,
  { code, recordId, userId, purpose = 'verify' }
) {
  try {
    const actual = hashEmailCode({ code, recordId, userId, purpose });
    const a = safeBuffer(String(expectedHash || ''));
    const b = safeBuffer(actual);
    if (a.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export default {
  EMAIL_CODE_TTL_MS,
  EMAIL_CODE_COOLDOWN_MS,
  EMAIL_CODE_MAX_ATTEMPTS,
  normalizeEmailCodePurpose,
  normalizeEmailCodeInput,
  generateSixDigitCode,
  hashEmailCode,
  verifyEmailCodeHash,
};
