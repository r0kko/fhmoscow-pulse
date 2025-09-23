import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import RedisRateLimitStore from '../src/middlewares/stores/redisRateLimitStore.js';

function createFakeRedisClient() {
  const execResults = [];
  const multiObjects = [];

  const client = {
    multi: jest.fn(() => {
      const multiObject = {
        get: jest.fn().mockReturnThis(),
        pTTL: jest.fn().mockReturnThis(),
        incr: jest.fn().mockReturnThis(),
        exec: jest.fn(() => Promise.resolve(execResults.shift() ?? [])),
      };
      multiObjects.push(multiObject);
      return multiObject;
    }),
    pExpire: jest.fn(() => Promise.resolve()),
    decr: jest.fn(() => Promise.resolve(0)),
    del: jest.fn(() => Promise.resolve()),
    enqueueResult: (...results) => {
      execResults.push(...results);
    },
    getMultiObject: (index = 0) => multiObjects[index],
  };

  return client;
}

describe('RedisRateLimitStore', () => {
  let client;
  let store;

  beforeEach(() => {
    client = createFakeRedisClient();
    store = new RedisRateLimitStore({ client, prefix: 'acct' });
  });

  test('constructor sets sane defaults', () => {
    expect(store.prefix).toBe('acct');
    expect(store.prefixString).toBe('acct:');
    expect(store.windowMs).toBe(60_000);
    expect(store.localKeys).toBe(false);
  });

  test('init updates window size as number', () => {
    store.init({ windowMs: '45000' });
    expect(store.windowMs).toBe(45_000);
  });

  test('key helper applies prefix', () => {
    expect(store.key('ip')).toBe('acct:ip');
  });

  test('get returns hit count and reset time when ttl available', async () => {
    client.enqueueResult(['5', 1_500]);

    const result = await store.get('ip');

    expect(client.multi).toHaveBeenCalledTimes(1);
    const multiCall = client.getMultiObject(0);
    expect(multiCall.get).toHaveBeenCalledWith('acct:ip');
    expect(result.totalHits).toBe(5);
    expect(result.resetTime).toBeInstanceOf(Date);
    expect(result.resetTime?.getTime()).toBeGreaterThan(Date.now());
  });

  test('get returns zero hits when counter missing', async () => {
    client.enqueueResult([null, -1]);

    const result = await store.get('missing');

    expect(result.totalHits).toBe(0);
    expect(result.resetTime).toBeUndefined();
  });

  test('increment sets expiry on first hit', async () => {
    store.init({ windowMs: 5_000 });
    client.enqueueResult([1, -1]);

    const result = await store.increment('user');

    expect(result.totalHits).toBe(1);
    expect(client.pExpire).toHaveBeenCalledWith('acct:user', 5_000);
    expect(result.resetTime?.getTime()).toBeGreaterThanOrEqual(Date.now());
  });

  test('increment refreshes expiry when ttl dropped', async () => {
    store.init({ windowMs: 10_000 });
    client.enqueueResult([3, -5]);

    await store.increment('user');

    expect(client.pExpire).toHaveBeenCalledWith('acct:user', 10_000);
  });

  test('increment preserves existing ttl when available', async () => {
    client.enqueueResult([4, 2_400]);

    const result = await store.increment('user');

    expect(client.pExpire).not.toHaveBeenCalled();
    expect(result.totalHits).toBe(4);
    expect(result.resetTime?.getTime()).toBeGreaterThan(Date.now());
  });

  test('decrement removes key when counter non-positive', async () => {
    client.decr = jest.fn().mockResolvedValue(0);

    await store.decrement('user');

    expect(client.decr).toHaveBeenCalledWith('acct:user');
    expect(client.del).toHaveBeenCalledWith('acct:user');
  });

  test('decrement ignores redis errors', async () => {
    client.decr = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(store.decrement('user')).resolves.toBeUndefined();
    expect(client.del).not.toHaveBeenCalled();
  });

  test('resetKey deletes redis entry', async () => {
    await store.resetKey('user');
    expect(client.del).toHaveBeenCalledWith('acct:user');
  });

  test('resetAll resolves without side effects', async () => {
    await expect(store.resetAll()).resolves.toBeUndefined();
  });

  test('shutdown resolves without touching shared client', async () => {
    await expect(store.shutdown()).resolves.toBeUndefined();
  });
});
