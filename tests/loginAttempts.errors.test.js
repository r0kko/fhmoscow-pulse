import { describe, expect, jest, test } from '@jest/globals';

describe('loginAttempts READONLY error handling', () => {
  test('markFailed returns 1 on READONLY error', async () => {
    jest.resetModules();
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      default: {
        async get() {
          throw new Error('READONLY You can not do that');
        },
        async set() {},
        async del() {},
        async keys() {
          return [];
        },
      },
    }));
    const { markFailed } = await import('../src/services/loginAttempts.js');
    await expect(markFailed('u1')).resolves.toBe(1);
  });

  test('get returns 0 on READONLY error', async () => {
    jest.resetModules();
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      default: {
        async get() {
          throw new Error('READONLY');
        },
        async del() {},
        async keys() {
          return [];
        },
      },
    }));
    const { get } = await import('../src/services/loginAttempts.js');
    await expect(get('u1')).resolves.toBe(0);
  });

  test('clear swallows READONLY error and non-readonly rethrows', async () => {
    jest.resetModules();
    // READONLY case
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      default: {
        async del() {
          throw new Error('READONLY');
        },
      },
    }));
    const { clear } = await import('../src/services/loginAttempts.js');
    await expect(clear('u1')).resolves.toBeUndefined();

    // non-readonly case
    jest.resetModules();
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      default: {
        async del() {
          throw new Error('oops');
        },
      },
    }));
    const { clear: clear2 } = await import('../src/services/loginAttempts.js');
    await expect(clear2('u1')).rejects.toThrow('oops');
  });

  test('_reset tolerates READONLY errors', async () => {
    jest.resetModules();
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      default: {
        async keys() {
          return ['login_attempts:x'];
        },
        async del() {
          throw new Error('READONLY');
        },
      },
    }));
    const { _reset } = await import('../src/services/loginAttempts.js');
    await expect(_reset()).resolves.toBeUndefined();
  });
});
