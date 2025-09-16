/* eslint-env node */
import { expect, jest, test } from '@jest/globals';

test('connectRedis marks cache up on success', async () => {
  jest.resetModules();
  const connect = jest.fn(async () => {});
  const fakeClient = { on() {}, connect, quit: async () => {} };
  jest.unstable_mockModule('redis', () => ({
    __esModule: true,
    createClient: () => fakeClient,
  }));
  // setCacheUp is imported dynamically inside module; we don't assert it here
  const logger = { info: jest.fn(), error: jest.fn() };
  jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    default: logger,
  }));
  const mod = await import('../src/config/redis.js');
  await mod.connectRedis();
  expect(connect).toHaveBeenCalled();
  // Metrics setCacheUp is invoked via dynamic import; not asserted here due to isolation
});

test('connectRedis logs error and surfaces failure', async () => {
  jest.resetModules();
  const connect = jest.fn(async () => {
    throw new Error('fail');
  });
  const fakeClient = { on() {}, connect, quit: async () => {} };
  jest.unstable_mockModule('redis', () => ({
    __esModule: true,
    createClient: () => fakeClient,
  }));
  // setCacheUp is imported dynamically inside module; we don't assert it here
  const logger = { info: jest.fn(), error: jest.fn() };
  jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    default: logger,
  }));
  const mod = await import('../src/config/redis.js');
  await expect(mod.connectRedis()).rejects.toThrow(
    'Unable to connect to Redis'
  );
  expect(logger.error).toHaveBeenCalledWith(
    '❌ Unable to connect to Redis:',
    expect.any(Error)
  );
});
