import { COOKIE_NAME, COOKIE_OPTIONS } from '../config/auth.js';

/**
 * Set refresh-token cookie.
 *
 * @param {import('express').Response} res
 * @param {string} token
 */
export function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
}

/**
 * Clear refresh-token cookie.
 *
 * @param {import('express').Response} res
 */
export function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
}
