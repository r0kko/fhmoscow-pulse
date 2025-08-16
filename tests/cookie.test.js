/* global process */
import { expect, test, jest } from '@jest/globals';
import { setRefreshCookie, clearRefreshCookie } from '../src/utils/cookie.js';

test('setRefreshCookie calls res.cookie with options', () => {
  const res = { cookie: jest.fn() };
  setRefreshCookie(res, 'token');
  expect(res.cookie).toHaveBeenCalledWith(
    'refresh_token',
    'token',
    expect.objectContaining({
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
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
      sameSite: 'strict',
      secure: false,
      path: '/',
    })
  );
  const options = res.clearCookie.mock.calls[0][1];
  expect(options).not.toHaveProperty('maxAge');
});

test('refresh cookie respects configured domain', async () => {
  process.env.COOKIE_DOMAIN = 'example.com';
  let setCookie, clearCookie;
  await jest.isolateModulesAsync(async () => {
    ({ setRefreshCookie: setCookie, clearRefreshCookie: clearCookie } = await import(
      '../src/utils/cookie.js'
    ));
  });
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };
  setCookie(res, 'tok');
  clearCookie(res);
  expect(res.cookie).toHaveBeenCalledWith(
    'refresh_token',
    'tok',
    expect.objectContaining({ domain: 'example.com' })
  );
  expect(res.clearCookie).toHaveBeenCalledWith(
    'refresh_token',
    expect.objectContaining({ domain: 'example.com' })
  );
  delete process.env.COOKIE_DOMAIN;
});
