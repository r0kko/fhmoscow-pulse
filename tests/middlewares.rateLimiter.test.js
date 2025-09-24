import {
  jest,
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

describe('rateLimiter middleware', () => {
  let incRateLimitedMock;
  let sendErrorMock;
  let isRedisWritableMock;
  let RedisStoreMock;
  let rateLimitMock;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };

    incRateLimitedMock = jest.fn();
    sendErrorMock = jest.fn();
    isRedisWritableMock = jest.fn().mockReturnValue(true);
    RedisStoreMock = jest.fn(function RedisRateLimitStore(options) {
      this.options = options;
      this.init = jest.fn();
    });

    rateLimitMock = jest.fn((options) => {
      rateLimitMock.lastOptions = options;
      return (req, res, next) => {
        if (options.skip(req)) {
          return next();
        }
        return options.handler(req, res, next, options);
      };
    });
    rateLimitMock.ipKeyGenerator = (ip, prefix) => `${ip}/${prefix}`;

    jest.unstable_mockModule('express-rate-limit', () => ({
      __esModule: true,
      default: rateLimitMock,
      ipKeyGenerator: rateLimitMock.ipKeyGenerator,
    }));
    jest.unstable_mockModule('../src/config/metrics.js', () => ({
      __esModule: true,
      incRateLimited: incRateLimitedMock,
    }));
    jest.unstable_mockModule('../src/config/redis.js', () => ({
      __esModule: true,
      isRedisWritable: isRedisWritableMock,
    }));
    jest.unstable_mockModule('../src/utils/api.js', () => ({
      __esModule: true,
      sendError: sendErrorMock,
    }));
    jest.unstable_mockModule(
      '../src/middlewares/stores/redisRateLimitStore.js',
      () => ({
        __esModule: true,
        default: RedisStoreMock,
      })
    );
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test('falls back to pass-through middleware when disabled', async () => {
    delete process.env.RATE_LIMIT_ENABLED;
    delete process.env.RATE_LIMIT_GLOBAL_ENABLED;

    const { default: middleware } = await import(
      '../src/middlewares/rateLimiter.js'
    );

    const next = jest.fn();
    await middleware({ method: 'GET', path: '/' }, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(sendErrorMock).not.toHaveBeenCalled();
    expect(incRateLimitedMock).not.toHaveBeenCalled();
  });

  test('uses redis store and emits error response when enabled', async () => {
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_USE_REDIS = 'true';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_MAX = '1200';

    const { default: middleware } = await import(
      '../src/middlewares/rateLimiter.js'
    );

    expect(RedisStoreMock).toHaveBeenCalledWith({ prefix: 'rate:global' });
    expect(typeof middleware).toBe('function');

    const req = {
      method: 'POST',
      path: '/api/resource',
      ip: '192.0.2.10',
      user: { id: '42' },
    };
    const res = {};
    const next = jest.fn();

    await middleware(req, res, next);

    expect(rateLimitMock).toHaveBeenCalledTimes(1);
    expect(incRateLimitedMock).toHaveBeenCalledWith('global');
    expect(sendErrorMock).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        status: 429,
        code: 'rate_limited',
        retryAfter: expect.any(Number),
      })
    );

    const { keyGenerator } = rateLimitMock.lastOptions;
    expect(keyGenerator({ user: { id: '42' }, ip: '198.51.100.5' })).toBe(
      'u:42'
    );
    expect(keyGenerator({ ip: '203.0.113.77' })).toBe('ip:203.0.113.77/64');
  });

  test('skips health and safe methods even when enabled', async () => {
    process.env.RATE_LIMIT_ENABLED = 'true';

    const { default: middleware } = await import(
      '../src/middlewares/rateLimiter.js'
    );

    const next = jest.fn();

    await middleware({ method: 'OPTIONS', path: '/' }, {}, next);
    await middleware({ method: 'GET', path: '/health' }, {}, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(sendErrorMock).not.toHaveBeenCalled();
  });
});
