import { expect, jest, test } from '@jest/globals';

test('withRedisLock acquires and releases lock', async () => {
  jest.resetModules();
  const calls = [];
  jest.unstable_mockModule('../src/config/redis.js', () => ({
    __esModule: true,
    default: {
      async set(key, value, opts) {
        calls.push(['set', key, value, opts]);
        return 'OK';
      },
      async eval(_lua, { keys, arguments: args }) {
        calls.push(['eval', keys, args]);
        return 1;
      },
    },
    isRedisWritable: () => true,
  }));
  const { withRedisLock, buildJobLockKey } = await import(
    '../src/utils/redisLock.js'
  );
  const key = buildJobLockKey('demo');
  const result = await withRedisLock(key, 1000, async () => 'work');
  expect(result).toBe('work');
  expect(calls[0][0]).toBe('set');
  expect(calls.at(-1)[0]).toBe('eval');
});

test('withRedisLock falls back to onBusy when cannot acquire and writable', async () => {
  jest.resetModules();
  jest.unstable_mockModule('../src/config/redis.js', () => ({
    __esModule: true,
    default: {
      async set() {
        return null;
      }, // NX set failed (already held)
      async eval() {},
    },
    isRedisWritable: () => true,
  }));
  const { withRedisLock } = await import('../src/utils/redisLock.js');
  const res = await withRedisLock('k', 1000, async () => 'work', {
    onBusy: () => 'busy',
  });
  expect(res).toBe('busy');
});

test('withRedisLock runs function if redis not writable or error', async () => {
  jest.resetModules();
  jest.unstable_mockModule('../src/config/redis.js', () => ({
    __esModule: true,
    default: {
      async set() {
        throw new Error('READONLY');
      },
      async eval() {},
    },
    isRedisWritable: () => false,
  }));
  const { withRedisLock } = await import('../src/utils/redisLock.js');
  const res = await withRedisLock('k', 1000, async () => 42);
  expect(res).toBe(42);
});

test('withRedisLock returns null when busy and no onBusy', async () => {
  jest.resetModules();
  jest.unstable_mockModule('../src/config/redis.js', () => ({
    __esModule: true,
    default: {
      async set() {
        return null;
      },
      async eval() {},
    },
    isRedisWritable: () => true,
  }));
  const { withRedisLock } = await import('../src/utils/redisLock.js');
  const res = await withRedisLock('k', 1000, async () => 'never', {});
  expect(res).toBeNull();
});
