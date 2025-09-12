export const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '30m';
export const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '60d';
export const JWT_ALG = process.env.JWT_ALG || 'HS256';
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_ISS = process.env.JWT_ISS || 'fhmoscow-pulse';
export const JWT_AUD = process.env.JWT_AUD || 'web';
// Optional asymmetric keys support (RS*/ES*/EdDSA)
export const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || undefined;
export const JWT_KID = process.env.JWT_KID || undefined;
export const JWT_PUBLIC_KEYS = (() => {
  try {
    const raw = process.env.JWT_PUBLIC_KEYS || '';
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({ kid: String(x.kid || ''), key: String(x.key || '') }))
      .filter((x) => x.kid && x.key);
  } catch {
    return [];
  }
})();

import safeRegex from 'safe-regex';

import {
  cookieDomain as secCookieDomain,
  isSecureEnv,
  cookieSameSite,
} from './security.js';

export const PASSWORD_MIN_LENGTH =
  parseInt(process.env.PASSWORD_MIN_LENGTH, 10) || 8;
export const PASSWORD_MAX_LENGTH =
  parseInt(process.env.PASSWORD_MAX_LENGTH, 10) || 128;

const rawPasswordPattern =
  process.env.PASSWORD_PATTERN || '(?=.*[A-Za-z])(?=.*\\d)';

if (!safeRegex(rawPasswordPattern)) {
  throw new Error('Unsafe PASSWORD_PATTERN');
}

export const PASSWORD_PATTERN = new RegExp(rawPasswordPattern);
export const PASSWORD_PATTERN_STR = rawPasswordPattern;

export const COOKIE_NAME = 'refresh_token';
export const COOKIE_HTTP_ONLY = true;
// Choose secure defaults that work with SPA on a different origin when HTTPS
// - In secure env (prod/https) default SameSite=None to allow cross-site XHR with credentials
// - In non-secure env default to Lax for local dev
export const COOKIE_SAME_SITE =
  process.env.REFRESH_COOKIE_SAME_SITE || cookieSameSite();
export const COOKIE_SECURE = isSecureEnv();
export const COOKIE_MAX_AGE = parseInt(
  process.env.REFRESH_COOKIE_MAX_AGE_MS || '5184000000',
  10
); // default 60 days in ms
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || secCookieDomain();
// Opt-in to partitioned cookies by default in secure envs when SameSite=None
export const COOKIE_PARTITIONED =
  String(process.env.COOKIE_PARTITIONED || 'true').toLowerCase() === 'true' &&
  COOKIE_SECURE &&
  String(COOKIE_SAME_SITE).toLowerCase() === 'none';
// Hint for modern browsers to keep refresh cookies around during contention
export const COOKIE_PRIORITY = process.env.COOKIE_PRIORITY || 'High';

export const COOKIE_OPTIONS = {
  httpOnly: COOKIE_HTTP_ONLY,
  sameSite: COOKIE_SAME_SITE,
  secure: COOKIE_SECURE,
  maxAge: COOKIE_MAX_AGE,
  path: '/',
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  ...(COOKIE_PARTITIONED ? { partitioned: true } : {}),
  ...(COOKIE_PRIORITY ? { priority: COOKIE_PRIORITY } : {}),
};

// Login security policy (hardcoded for consistency across environments)
// - Up to 10 invalid password attempts within 15 minutes
// - Then temporary lockout for 30 minutes
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes
