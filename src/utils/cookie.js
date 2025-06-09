const SECURE_COOKIE = process.env.NODE_ENV === 'production';
const COOKIE_NAME = 'refresh_token';
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

/**
 * Set refresh-token cookie.
 *
 * @param {import('express').Response} res
 * @param {string} token
 */
export function setRefreshCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: SECURE_COOKIE,
    maxAge: REFRESH_MAX_AGE,
  });
}

/**
 * Clear refresh-token cookie.
 *
 * @param {import('express').Response} res
 */
export function clearRefreshCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: SECURE_COOKIE,
  });
}
