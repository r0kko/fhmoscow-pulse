import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const CONFIG_KEYS = [
  'API_DOCS_ACCESS',
  'API_DOCS_MODE',
  'API_DOCS_VISIBILITY',
  'API_DOCS_ALLOWLIST',
  'API_DOCS_ALLOW',
];

const ORIGINAL_ENV = CONFIG_KEYS.reduce((acc, key) => {
  if (process.env[key] !== undefined) acc[key] = process.env[key];
  return acc;
}, {});

beforeEach(() => {
  jest.resetModules();
  CONFIG_KEYS.forEach((key) => {
    delete process.env[key];
  });
});

afterEach(() => {
  jest.resetModules();
  CONFIG_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(ORIGINAL_ENV, key)) {
      process.env[key] = ORIGINAL_ENV[key];
    } else {
      delete process.env[key];
    }
  });
});

test('permits loopback by default', async () => {
  const { isApiDocsRequestAllowed } = await import('../src/config/docs.js');
  const allowed = isApiDocsRequestAllowed({ ip: '127.0.0.1' });
  expect(allowed).toBe(true);
});

test('blocks public Internet clients by default', async () => {
  const { isApiDocsRequestAllowed } = await import('../src/config/docs.js');
  const allowed = isApiDocsRequestAllowed({ ip: '203.0.113.4' });
  expect(allowed).toBe(false);
});

test('permits IPv6 unique-local addresses by default', async () => {
  const { isApiDocsRequestAllowed } = await import('../src/config/docs.js');
  const allowed = isApiDocsRequestAllowed({ ip: 'fd12:3456:789a::1' });
  expect(allowed).toBe(true);
});

test('exposes docs when explicitly set to public', async () => {
  process.env.API_DOCS_ACCESS = 'public';
  const { isApiDocsRequestAllowed } = await import('../src/config/docs.js');
  const allowed = isApiDocsRequestAllowed({ ip: '203.0.113.4' });
  expect(allowed).toBe(true);
});

test('allow list extends default private ranges', async () => {
  process.env.API_DOCS_ALLOWLIST = '203.0.113.0/24';
  const { isApiDocsRequestAllowed } = await import('../src/config/docs.js');
  const viaForwarded = isApiDocsRequestAllowed({
    headers: { 'x-forwarded-for': '203.0.113.10' },
  });
  const outside = isApiDocsRequestAllowed({
    headers: { 'x-forwarded-for': '198.51.100.2' },
  });
  expect(viaForwarded).toBe(true);
  expect(outside).toBe(false);
});

test('disabled mode returns 404 semantics', async () => {
  process.env.API_DOCS_ACCESS = 'disabled';
  const { isDocsEnabled, isApiDocsRequestAllowed } =
    await import('../src/config/docs.js');
  expect(isDocsEnabled()).toBe(false);
  expect(isApiDocsRequestAllowed({ ip: '127.0.0.1' })).toBe(false);
});

test('middleware short-circuits non-local traffic', async () => {
  const guardModule = await import('../src/middlewares/apiDocsGuard.js');
  const guard = guardModule.default;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  guard({ ip: '203.0.113.5' }, res, next);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'not_found' });
  expect(next).not.toHaveBeenCalled();
});

test('middleware allows traffic when explicitly public', async () => {
  process.env.API_DOCS_ACCESS = 'public';
  const guardModule = await import('../src/middlewares/apiDocsGuard.js');
  const guard = guardModule.default;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  guard({ ip: '203.0.113.5' }, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(res.status).not.toHaveBeenCalled();
});
