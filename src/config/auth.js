export const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
export const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';
export const JWT_ALG = process.env.JWT_ALG || 'HS256';
export const JWT_SECRET = process.env.JWT_SECRET;

import safeRegex from 'safe-regex';

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

export const COOKIE_NAME = 'refresh_token';
export const COOKIE_HTTP_ONLY = true;
export const COOKIE_SAME_SITE = 'strict';
export const COOKIE_SECURE = process.env.NODE_ENV === 'production';
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;

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
