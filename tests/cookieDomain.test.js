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

test('setRefreshCookie omits domain when host mismatches', async () => {
  jest.resetModules();
  const { setRefreshCookie } = await import('../src/utils/cookie.js');
  const res = {
    req: { headers: { host: 'evil.test:3000' } },
    cookie: jest.fn(),
  };
  setRefreshCookie(res, 'tok');
  const [, , opts] = res.cookie.mock.calls[0];
  expect(opts).not.toHaveProperty('domain');
});

test('setRefreshCookie uses x-forwarded-host and strips port', async () => {
  jest.resetModules();
  const { setRefreshCookie } = await import('../src/utils/cookie.js');
  const res = {
    req: {
      headers: {
        'x-forwarded-host': 'api.example.com:8443, proxy-chain',
        host: 'another-host.local',
      },
    },
    cookie: jest.fn(),
  };
  setRefreshCookie(res, 'tok');
  const [, , opts] = res.cookie.mock.calls[0];
  expect(opts).toMatchObject({ domain: 'example.com' });
});

test('setRefreshCookie includes domain when host equals domain (no port)', async () => {
  jest.resetModules();
  const { setRefreshCookie } = await import('../src/utils/cookie.js');
  const res = {
    req: { headers: { host: 'example.com' } },
    cookie: jest.fn(),
  };
  setRefreshCookie(res, 'tok');
  const [, , opts] = res.cookie.mock.calls[0];
  expect(opts).toMatchObject({ domain: 'example.com' });
});
