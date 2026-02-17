import crypto from 'crypto';

const UNKNOWN = 'unknown';

function getRateLimitSecret() {
  return (
    process.env.RATE_LIMIT_KEY_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    ''
  );
}

function normalizeIdentifier(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function hashWithOptionalHmac(value, secret) {
  const input = normalizeIdentifier(value);
  if (!input) return UNKNOWN;
  if (!secret) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }
  return crypto.createHmac('sha256', secret).update(input).digest('hex');
}

export function getRateLimitHashSecret() {
  return getRateLimitSecret();
}

export function hashRateLimitIdentifier(value) {
  return hashWithOptionalHmac(value, getRateLimitSecret());
}

export function hashIpForRateLimit(value) {
  return hashWithOptionalHmac(
    String(value || '')
      .replace(/\s+/g, '')
      .trim()
      .toLowerCase(),
    getRateLimitSecret()
  );
}
