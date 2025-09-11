import crypto from 'crypto';

import '../config/env.js';

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

function getSecret() {
  return (
    process.env.VERIFY_HMAC_SECRET ||
    process.env.CSRF_HMAC_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    ''
  );
}

function hmac(payload) {
  const secret = getSecret();
  if (!secret) throw new Error('VERIFY HMAC secret is not configured');
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest();
}

// Build a compact verification token from identifiers.
// payload: { d: docId, s: signId, u: userId, v?: number }
export function buildVerifyToken(payload) {
  const body = b64urlEncode(
    JSON.stringify({ d: payload.d, s: payload.s, u: payload.u, v: 1 })
  );
  const sig = b64urlEncode(hmac(body));
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') return { ok: false };
    if (!getSecret()) return { ok: false };
    const [body, sig] = token.split('.');
    if (!body || !sig) return { ok: false };
    const expected = b64urlEncode(hmac(body));
    const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return { ok: false };
    const json = b64urlDecode(body);
    const data = JSON.parse(json);
    if (!data?.d || !data?.s || !data?.u) return { ok: false };
    return { ok: true, payload: data };
  } catch {
    return { ok: false };
  }
}

export function buildVerifyUrl({ d, s, u }) {
  const base = (process.env.BASE_URL || 'https://lk.fhmoscow.com').replace(
    /\/+$/,
    ''
  );
  const t = buildVerifyToken({ d, s, u });
  return `${base}/verify?t=${encodeURIComponent(t)}`;
}

export default { buildVerifyToken, verifyToken, buildVerifyUrl };
