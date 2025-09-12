import { expect, test, jest } from '@jest/globals';
import {
  setRefreshCookie,
  clearRefreshCookie,
  getCookieCandidates,
  getRefreshTokenCandidates,
} from '../src/utils/cookie.js';
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

test('getCookieCandidates parses duplicates and preserves order', () => {
  const req = {
    headers: {
      cookie:
        'a=1; refresh_token=first; other=x; refresh_token=second; refresh_token=second',
    },
  };
  const vals = getCookieCandidates(req, 'refresh_token');
  expect(vals).toEqual(['first', 'second']);
});

test('getRefreshTokenCandidates uses standard cookie name', () => {
  const req = { headers: { cookie: 'refresh_token=abc.def; foo=bar' } };
  const vals = getRefreshTokenCandidates(req);
  expect(vals).toEqual(['abc.def']);
});
