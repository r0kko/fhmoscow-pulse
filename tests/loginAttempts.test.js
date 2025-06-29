import { beforeEach, describe, expect, test, jest } from '@jest/globals';

const store = new Map();
jest.unstable_mockModule('../src/config/redis.js', () => ({
  __esModule: true,
  default: {
    async get(k) {
      return store.has(k) ? store.get(k) : null;
    },
    async set(k, v) {
      store.set(k, v);
    },
    async del(keys) {
      if (Array.isArray(keys)) {
        keys.forEach((k) => store.delete(k));
      } else {
        store.delete(keys);
      }
    },
    async keys(pattern) {
      const prefix = pattern.replace(/\*/g, '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    },
  },
}));

const { markFailed, clear, get, _reset, WINDOW_MS } = await import('../src/services/loginAttempts.js');

describe('loginAttempts service', () => {
  beforeEach(async () => {
    await _reset();
  });

  test('markFailed increments attempts within window', async () => {
    await expect(markFailed('u1', 0)).resolves.toBe(1);
    await expect(markFailed('u1', 1000)).resolves.toBe(2);
  });

  test('markFailed resets after window passes', async () => {
    await markFailed('u1', 0);
    await expect(markFailed('u1', WINDOW_MS + 1)).resolves.toBe(1);
  });

  test('clear removes stored attempts', async () => {
    await markFailed('u1', 0);
    await clear('u1');
    await expect(get('u1', 0)).resolves.toBe(0);
  });

  test('get returns zero after window expires', async () => {
    await markFailed('u1', 0);
    await expect(get('u1', WINDOW_MS + 1)).resolves.toBe(0);
  });
});
