import { expect, test, jest } from '@jest/globals';
import { setRefreshCookie, clearRefreshCookie } from '../src/utils/cookie.js';
import { COOKIE_OPTIONS } from '../src/config/auth.js';

test('setRefreshCookie calls res.cookie with options', () => {
  const res = { cookie: jest.fn() };
  setRefreshCookie(res, 'token');
  expect(res.cookie).toHaveBeenCalledWith(
    'refresh_token',
    'token',
    expect.objectContaining({
      httpOnly: true,
      sameSite: COOKIE_OPTIONS.sameSite,
      secure: COOKIE_OPTIONS.secure,
      maxAge: expect.any(Number),
      path: '/',
    })
  );
});

test('clearRefreshCookie calls res.clearCookie with options', () => {
  const res = { clearCookie: jest.fn() };
  clearRefreshCookie(res);
  expect(res.clearCookie).toHaveBeenCalledWith(
    'refresh_token',
    expect.objectContaining({
      httpOnly: true,
      sameSite: COOKIE_OPTIONS.sameSite,
      secure: COOKIE_OPTIONS.secure,
      path: '/',
    })
  );
  const options = res.clearCookie.mock.calls[0][1];
  expect(options).not.toHaveProperty('maxAge');
});
