export const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '30m';
export const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '60d';
export const JWT_ALG = process.env.JWT_ALG || 'HS256';
export const JWT_SECRET = process.env.JWT_SECRET;

import safeRegex from 'safe-regex';

import { cookieDomain as secCookieDomain, isSecureEnv } from './security.js';

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
// Default to 'strict' to match existing client/session expectations; allow override via env
export const COOKIE_SAME_SITE =
  process.env.REFRESH_COOKIE_SAME_SITE || 'strict';
export const COOKIE_SECURE = isSecureEnv();
export const COOKIE_MAX_AGE = parseInt(
  process.env.REFRESH_COOKIE_MAX_AGE_MS || '5184000000',
  10
); // default 60 days in ms
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || secCookieDomain();

export const COOKIE_OPTIONS = {
  httpOnly: COOKIE_HTTP_ONLY,
  sameSite: COOKIE_SAME_SITE,
  secure: COOKIE_SECURE,
  maxAge: COOKIE_MAX_AGE,
  path: '/',
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

// Login security policy (hardcoded for consistency across environments)
// - Up to 10 invalid password attempts within 15 minutes
// - Then temporary lockout for 30 minutes
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes
