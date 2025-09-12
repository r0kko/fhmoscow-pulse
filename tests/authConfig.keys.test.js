import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const saved = { JWT_PUBLIC_KEYS: process.env.JWT_PUBLIC_KEYS };

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  if (saved.JWT_PUBLIC_KEYS === undefined) delete process.env.JWT_PUBLIC_KEYS;
  else process.env.JWT_PUBLIC_KEYS = saved.JWT_PUBLIC_KEYS;
});

test('JWT_PUBLIC_KEYS parses valid JSON array of keys', async () => {
  process.env.JWT_PUBLIC_KEYS = JSON.stringify([
    { kid: 'k1', key: '-----BEGIN KEY-----A' },
    { kid: 'k2', key: '-----BEGIN KEY-----B' },
  ]);
  const mod = await import('../src/config/auth.js');
  expect(mod.JWT_PUBLIC_KEYS).toEqual([
    { kid: 'k1', key: '-----BEGIN KEY-----A' },
    { kid: 'k2', key: '-----BEGIN KEY-----B' },
  ]);
});

test('JWT_PUBLIC_KEYS falls back to [] on invalid JSON', async () => {
  process.env.JWT_PUBLIC_KEYS = '{ not-json';
  const mod = await import('../src/config/auth.js');
  expect(mod.JWT_PUBLIC_KEYS).toEqual([]);
});

