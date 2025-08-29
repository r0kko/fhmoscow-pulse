import { expect, jest, test } from '@jest/globals';

test('isRedisWritable flips to false on READONLY error', async () => {
  jest.resetModules();
  let errorHandler = () => {};
  const fakeClient = {
    on(event, cb) {
      if (event === 'error') errorHandler = cb;
    },
    async connect() {},
    async quit() {},
  };
  jest.unstable_mockModule('redis', () => ({
    __esModule: true,
    createClient: () => fakeClient,
  }));
  const mod = await import('../src/config/redis.js');
  expect(mod.isRedisWritable()).toBe(true);
  errorHandler(new Error('READONLY You can not write against a read only replica.'));
  expect(mod.isRedisWritable()).toBe(false);
});

test('closeRedis calls client.quit()', async () => {
  jest.resetModules();
  const quit = jest.fn();
  const fakeClient = {
    on() {},
    async connect() {},
    async quit() { quit(); },
  };
  jest.unstable_mockModule('redis', () => ({
    __esModule: true,
    createClient: () => fakeClient,
  }));
  const mod = await import('../src/config/redis.js');
  await mod.closeRedis();
  expect(quit).toHaveBeenCalled();
});

test('non-READONLY errors do not flip writable flag', async () => {
  jest.resetModules();
  let errorHandler = () => {};
  const fakeClient = {
    on(event, cb) {
      if (event === 'error') errorHandler = cb;
    },
    async connect() {},
    async quit() {},
  };
  jest.unstable_mockModule('redis', () => ({
    __esModule: true,
    createClient: () => fakeClient,
  }));
  const mod = await import('../src/config/redis.js');
  expect(mod.isRedisWritable()).toBe(true);
  errorHandler(new Error('SOME OTHER ERROR'));
  expect(mod.isRedisWritable()).toBe(true);
});
