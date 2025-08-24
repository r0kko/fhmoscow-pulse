/* global process */
import { expect, jest, test } from '@jest/globals';

function buildMocks() {
  const middleware = jest.fn();
  const sessionMock = jest.fn(() => middleware);
  jest.unstable_mockModule('express-session', () => ({
    __esModule: true,
    default: sessionMock,
  }));
  jest.unstable_mockModule('connect-redis', () => ({
    __esModule: true,
    RedisStore: jest.fn(() => jest.fn()),
  }));
  jest.unstable_mockModule('../src/config/redis.js', () => ({
    __esModule: true,
    default: {},
    isRedisWritable: () => true,
  }));
  return { sessionMock, middleware };
}

test('session cookie secure and sameSite none in production', async () => {
  process.env.NODE_ENV = 'production';
  jest.resetModules();
  const { sessionMock } = buildMocks();
  const { default: session } = await import('../src/config/session.js');
  expect(sessionMock).toHaveBeenCalledWith(
    expect.objectContaining({
      cookie: expect.objectContaining({ secure: true, sameSite: 'none' }),
    })
  );
  expect(typeof session).toBe('function');
});

test('session cookie lax in development', async () => {
  process.env.NODE_ENV = 'development';
  jest.resetModules();
  const { sessionMock } = buildMocks();
  const { default: session } = await import('../src/config/session.js');
  expect(sessionMock).toHaveBeenCalledWith(
    expect.objectContaining({
      cookie: expect.objectContaining({ secure: false, sameSite: 'lax' }),
    })
  );
  expect(typeof session).toBe('function');
});

test('uses MemoryStore when redis not writable', async () => {
  process.env.NODE_ENV = 'development';
  jest.resetModules();
  const middleware = jest.fn();
  const sessionMock = jest.fn(() => middleware);
  const memoryStoreCtor = jest.fn();
  jest.unstable_mockModule('express-session', () => ({
    __esModule: true,
    default: Object.assign(sessionMock, { MemoryStore: memoryStoreCtor }),
  }));
  jest.unstable_mockModule('connect-redis', () => ({
    __esModule: true,
    RedisStore: jest.fn(() => jest.fn()),
  }));
  jest.unstable_mockModule('../src/config/redis.js', () => ({
    __esModule: true,
    default: {},
    isRedisWritable: () => false,
  }));
  await import('../src/config/session.js');
  expect(memoryStoreCtor).toHaveBeenCalled();
});
