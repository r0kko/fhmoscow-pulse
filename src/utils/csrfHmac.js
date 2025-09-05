import crypto from 'crypto';

import '../config/env.js';

// Secret precedence: dedicated CSRF_HMAC_SECRET, else JWT_SECRET, else SESSION_SECRET
const SECRET =
  process.env.CSRF_HMAC_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;

// Default TTL: 6 hours (in seconds)
const DEFAULT_TTL = parseInt(process.env.CSRF_HMAC_TTL_SECONDS || '21600', 10);

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

function hmac(payload) {
  if (!SECRET) throw new Error('CSRF HMAC secret is not configured');
  return crypto.createHmac('sha256', SECRET).update(payload, 'utf8').digest();
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// Build a compact, signed token: base64url(JSON).base64url(HMAC)
export function issueCsrfHmac(req, ttlSeconds = DEFAULT_TTL) {
  const iat = nowSec();
  const exp = iat + Math.max(60, Number(ttlSeconds) || DEFAULT_TTL);
  const origin = req.get && (req.get('Origin') || req.get('origin'));
  const payload = {
    iat,
    exp,
    ori: origin || undefined,
    jti: b64urlEncode(crypto.randomBytes(12)),
    v: 1,
  };
  const json = JSON.stringify(payload);
  const body = b64urlEncode(json);
  const sig = b64urlEncode(hmac(body));
  return `${body}.${sig}`;
}

export function verifyCsrfHmac(token, req) {
  try {
    if (!token || typeof token !== 'string') return false;
    if (!SECRET) return false;
    const [body, sig] = token.split('.');
    if (!body || !sig) return false;
    const expected = b64urlEncode(hmac(body));
    // Constant-time compare
    const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return false;
    const json = b64urlDecode(body);
    const payload = JSON.parse(json);
    if (!payload?.iat || !payload?.exp) return false;
    const now = nowSec();
    if (now < payload.iat - 5) return false; // not before
    if (now > payload.exp) return false; // expired
    const reqOrigin = req.get && (req.get('Origin') || req.get('origin'));
    if (payload.ori && reqOrigin && payload.ori !== reqOrigin) return false;
    return true;
  } catch (_e) {
    return false;
  }
}

export default { issueCsrfHmac, verifyCsrfHmac };

