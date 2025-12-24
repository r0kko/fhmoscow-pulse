import { describe, expect, jest, test } from '@jest/globals';

describe('accountLockout service', () => {
  test('lock and isLocked with working redis', async () => {
    jest.resetModules();
    const store = new Map();
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      default: {
        async set(k, v) {
          store.set(k, v);
        },
        async get(k) {
          return store.get(k) ?? null;
        },
      },
    }));
    const { lock, isLocked } =
      await import('../src/services/accountLockout.js');
    await lock('u1', 1000);
    await expect(isLocked('u1')).resolves.toBe(true);
  });

  test('isLocked returns false on READONLY error and lock swallows READONLY', async () => {
    jest.resetModules();
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      default: {
        async set() {
          throw new Error('READONLY You can not do that');
        },
        async get() {
          throw new Error('READONLY');
        },
      },
    }));
    const { lock, isLocked } =
      await import('../src/services/accountLockout.js');
    await expect(lock('u2', 1000)).resolves.toBeUndefined();
    await expect(isLocked('u2')).resolves.toBe(false);
  });

  test('getTtlMs returns ms when present and 0 on READONLY', async () => {
    jest.resetModules();
    // success case
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      default: {
        async pTTL() {
          return 5000;
        },
        async get() {
          return '1';
        },
      },
    }));
    const mod1 = await import('../src/services/accountLockout.js');
    await expect(mod1.getTtlMs('u1')).resolves.toBe(5000);

    // READONLY case
    jest.resetModules();
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      default: {
        async pTTL() {
          throw new Error('READONLY');
        },
        async get() {
          throw new Error('READONLY');
        },
      },
    }));
    const mod2 = await import('../src/services/accountLockout.js');
    await expect(mod2.getTtlMs('u2')).resolves.toBe(0);
  });
});
