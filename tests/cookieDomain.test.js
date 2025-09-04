/* global process */
import { afterAll, beforeAll, expect, jest, test } from '@jest/globals';

let originalDomain;

beforeAll(() => {
  originalDomain = process.env.COOKIE_DOMAIN;
  process.env.COOKIE_DOMAIN = 'example.com';
});

afterAll(() => {
  process.env.COOKIE_DOMAIN = originalDomain;
});

test('clearRefreshCookie includes domain when COOKIE_DOMAIN is set', async () => {
  jest.resetModules();
  const { clearRefreshCookie } = await import('../src/utils/cookie.js');
  const res = { clearCookie: jest.fn() };
  clearRefreshCookie(res);
  const [, opts] = res.clearCookie.mock.calls[0];
  expect(opts).toMatchObject({
    domain: 'example.com',
    path: '/',
    httpOnly: true,
  });
});
