export const ACCESS_TTL   = process.env.JWT_ACCESS_TTL   || '15m';
export const REFRESH_TTL  = process.env.JWT_REFRESH_TTL  || '30d';
export const JWT_ALG      = process.env.JWT_ALG          || 'HS256';
export const JWT_SECRET   = process.env.JWT_SECRET;

export const COOKIE_NAME      = 'refresh_token';
export const COOKIE_HTTP_ONLY = true;
export const COOKIE_SAME_SITE = 'strict';
export const COOKIE_SECURE    = process.env.NODE_ENV === 'production';
export const COOKIE_MAX_AGE   = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

export const COOKIE_OPTIONS = {
  httpOnly: COOKIE_HTTP_ONLY,
  sameSite: COOKIE_SAME_SITE,
  secure:   COOKIE_SECURE,
  maxAge:   COOKIE_MAX_AGE,
};