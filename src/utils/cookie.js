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
  const { path, domain, httpOnly, sameSite, secure, partitioned, priority } =
    COOKIE_OPTIONS;
  const options = { path, httpOnly, sameSite, secure };
  if (domain) options.domain = domain;
  if (partitioned) options.partitioned = true;
  if (priority) options.priority = priority;
  res.clearCookie(COOKIE_NAME, options);
}
