import crypto from 'crypto';

import '../config/env.js';

const VERIFY_TOKEN_VERSION = 2;
const DEFAULT_TTL_DAYS = 365;
const MAX_TOKEN_LENGTH = 4096;

function b64urlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(str) {
  const pad = 4 - (str.length % 4 || 4);
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad % 4);
  return Buffer.from(s, 'base64').toString('utf8');
}

function b64urlDecodeToBuffer(str) {
  const pad = 4 - (str.length % 4 || 4);
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad % 4);
  return Buffer.from(s, 'base64');
}

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function getSecret() {
  if (process.env.VERIFY_HMAC_SECRET) return process.env.VERIFY_HMAC_SECRET;
  if (isProduction()) return '';
  return (
    process.env.CSRF_HMAC_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    ''
  );
}

function parseTtlDays(value) {
  const n = Number.parseInt(String(value || DEFAULT_TTL_DAYS), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TTL_DAYS;
  return Math.min(n, 3650);
}

function normalizeIssuedAt(input) {
  if (!input) return Math.floor(Date.now() / 1000);
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return Math.floor(Date.now() / 1000);
  return Math.floor(d.getTime() / 1000);
}

function hmac(payload) {
  const secret = getSecret();
  if (!secret) throw new Error('VERIFY HMAC secret is not configured');
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest();
}

// Build a compact verification token from identifiers.
// payload: { d: docId, s: signId, u: userId, v?: number }
export function buildVerifyToken(payload, options = {}) {
  if (!payload?.d || !payload?.s || !payload?.u) {
    throw new Error('verify_token_payload_invalid');
  }
  const iat = normalizeIssuedAt(options.issuedAt || payload.signedAt);
  const ttlDays = parseTtlDays(
    options.ttlDays || process.env.VERIFY_TOKEN_TTL_DAYS
  );
  const exp = iat + ttlDays * 24 * 60 * 60;
  const body = b64urlEncode(
    JSON.stringify({
      d: payload.d,
      s: payload.s,
      u: payload.u,
      iat,
      exp,
      v: VERIFY_TOKEN_VERSION,
    })
  );
  const sig = b64urlEncode(hmac(body));
  return `${body}.${sig}`;
}

export function verifyToken(token, options = {}) {
  try {
    if (!token || typeof token !== 'string')
      return { ok: false, error: 'invalid' };
    if (token.length > MAX_TOKEN_LENGTH) return { ok: false, error: 'invalid' };
    if (!getSecret()) return { ok: false, error: 'misconfigured' };
    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false, error: 'invalid' };
    const [body, sig] = parts;
    if (!body || !sig) return { ok: false, error: 'invalid' };
    if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(sig)) {
      return { ok: false, error: 'invalid' };
    }
    const expectedSig = hmac(body);
    const providedSig = b64urlDecodeToBuffer(sig);
    if (providedSig.length !== expectedSig.length) {
      return { ok: false, error: 'invalid' };
    }
    const ok = crypto.timingSafeEqual(providedSig, expectedSig);
    if (!ok) return { ok: false, error: 'invalid' };
    const json = b64urlDecode(body);
    const data = JSON.parse(json);
    if (!data?.d || !data?.s || !data?.u)
      return { ok: false, error: 'invalid' };
    const version = Number(data?.v || 1);
    if (version >= 2) {
      const exp = Number(data?.exp || 0);
      const iat = Number(data?.iat || 0);
      if (!Number.isFinite(exp) || !Number.isFinite(iat) || exp <= iat) {
        return { ok: false, error: 'invalid' };
      }
      const nowSec = Math.floor(Number(options.nowMs || Date.now()) / 1000);
      if (nowSec > exp) {
        return { ok: false, error: 'expired', payload: data, version };
      }
    }
    return { ok: true, payload: data, version };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}

export function buildVerifyUrl({ d, s, u, signedAt }) {
  const base = (process.env.BASE_URL || 'https://lk.fhmoscow.com').replace(
    /\/+$/,
    ''
  );
  const t = buildVerifyToken({ d, s, u, signedAt }, { issuedAt: signedAt });
  const preferHash =
    String(process.env.VERIFY_HASH_URL_ENABLED || 'true').toLowerCase() !==
    'false';
  if (preferHash) {
    return `${base}/verify#t=${encodeURIComponent(t)}`;
  }
  return `${base}/verify?t=${encodeURIComponent(t)}`;
}

export default { buildVerifyToken, verifyToken, buildVerifyUrl };
