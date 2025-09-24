import { jest, describe, expect, test, afterEach } from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

async function loadApp({ env = {}, metricsReject = null } = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };

  const cookieParserMock = jest.fn(() => (_req, _res, next) => next());
  const corsMock = jest.fn((options) => {
    corsMock.lastOptions = options;
    return (_req, _res, next) => next();
  });
  const swaggerServeMock = jest.fn((_req, _res, next) => next());
  const swaggerSetupMiddleware = jest.fn((_req, _res, next) => next());
  const swaggerSetupMock = jest.fn(() => swaggerSetupMiddleware);

  const csrfMwMock = jest.fn((_req, _res, next) => next());
  const sessionMock = jest.fn((_req, _res, next) => next());
  const indexRouterMock = jest.fn((_req, _res, next) => next());
  const requestLoggerMock = jest.fn((_req, _res, next) => next());
  const requestIdMock = jest.fn((_req, _res, next) => next());
  const rateLimiterMock = jest.fn((_req, _res, next) => next());
  const accessLogFactoryMock = jest.fn(() => (_req, _res, next) => next());
  const apiDocsGuardMock = jest.fn((_req, _res, next) => next());
  const helmetMiddlewareMock = jest.fn((_req, _res, next) => next());
  const cspMiddlewareMock = jest.fn((_req, _res, next) => next());
  const swaggerCspMock = jest.fn((_req, _res, next) => next());

  const httpMetricsMiddlewareMock = jest.fn(() => (_req, _res, next) => next());
  const startBusinessMetricsCollectorMock = jest.fn(() =>
    metricsReject ? Promise.reject(metricsReject) : Promise.resolve()
  );

  const sendErrorMock = jest.fn();
  const loggerErrorMock = jest.fn();
  const loggerWarnMock = jest.fn();

  jest.unstable_mockModule('cookie-parser', () => ({
    __esModule: true,
    default: cookieParserMock,
  }));
  jest.unstable_mockModule('cors', () => ({
    __esModule: true,
    default: corsMock,
  }));
  jest.unstable_mockModule('swagger-ui-express', () => ({
    __esModule: true,
    default: {
      serve: swaggerServeMock,
      setup: swaggerSetupMock,
    },
    serve: swaggerServeMock,
    setup: swaggerSetupMock,
  }));
  jest.unstable_mockModule('../src/middlewares/csrf.js', () => ({
    __esModule: true,
    default: csrfMwMock,
  }));
  jest.unstable_mockModule('../src/config/session.js', () => ({
    __esModule: true,
    default: sessionMock,
  }));
  jest.unstable_mockModule('../src/routes/index.js', () => ({
    __esModule: true,
    default: indexRouterMock,
  }));
  jest.unstable_mockModule('../src/middlewares/requestLogger.js', () => ({
    __esModule: true,
    default: requestLoggerMock,
  }));
  jest.unstable_mockModule('../src/middlewares/requestId.js', () => ({
    __esModule: true,
    default: requestIdMock,
  }));
  jest.unstable_mockModule('../src/middlewares/rateLimiter.js', () => ({
    __esModule: true,
    default: rateLimiterMock,
  }));
  jest.unstable_mockModule('../src/middlewares/accessLog.js', () => ({
    __esModule: true,
    default: accessLogFactoryMock,
  }));
  jest.unstable_mockModule('../src/middlewares/apiDocsGuard.js', () => ({
    __esModule: true,
    default: apiDocsGuardMock,
  }));
  jest.unstable_mockModule('../src/config/helmetConfig.js', () => ({
    __esModule: true,
    helmetMiddleware: helmetMiddlewareMock,
    contentSecurityPolicyMiddleware: cspMiddlewareMock,
    swaggerContentSecurityPolicyMiddleware: swaggerCspMock,
  }));
  jest.unstable_mockModule('../src/config/metrics.js', () => ({
    __esModule: true,
    httpMetricsMiddleware: httpMetricsMiddlewareMock,
    startBusinessMetricsCollector: startBusinessMetricsCollectorMock,
  }));
  jest.unstable_mockModule('../src/docs/swagger.js', () => ({
    __esModule: true,
    default: { openapi: '3.0.0' },
  }));
  jest.unstable_mockModule('../src/utils/api.js', () => ({
    __esModule: true,
    sendError: sendErrorMock,
  }));
  jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    default: {
      error: loggerErrorMock,
      warn: loggerWarnMock,
    },
  }));

  const mod = await import('../app.js');

  return {
    mod,
    mocks: {
      cookieParserMock,
      corsMock,
      swaggerServeMock,
      swaggerSetupMock,
      swaggerSetupMiddleware,
      csrfMwMock,
      sessionMock,
      indexRouterMock,
      requestLoggerMock,
      requestIdMock,
      rateLimiterMock,
      accessLogFactoryMock,
      apiDocsGuardMock,
      helmetMiddlewareMock,
      cspMiddlewareMock,
      swaggerCspMock,
      httpMetricsMiddlewareMock,
      startBusinessMetricsCollectorMock,
      sendErrorMock,
      loggerErrorMock,
      loggerWarnMock,
    },
  };
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('app bootstrap', () => {
  test('originAllowed recognises allowed origins and fallbacks', async () => {
    const { mod } = await loadApp({
      env: {
        ALLOWED_ORIGINS: 'https://allowed.example',
        COOKIE_DOMAIN: 'example.org',
        BASE_URL: 'https://base.example',
      },
    });

    const { originAllowed } = mod;
    expect(originAllowed(undefined)).toBe(true);
    expect(originAllowed('https://allowed.example')).toBe(true);
    expect(originAllowed('https://sub.example.org')).toBe(true);
    expect(originAllowed('https://base.example')).toBe(true);
    expect(originAllowed('invalid-url')).toBe(false);
    expect(originAllowed('https://denied.example')).toBe(false);
  });

  test('corsOptions origin callback uses originAllowed results', async () => {
    const { mod } = await loadApp({
      env: { ALLOWED_ORIGINS: 'https://allowed.local' },
    });
    const { corsOptions } = mod;

    await new Promise((resolve) => {
      corsOptions.origin('https://allowed.local', (err, allowed) => {
        expect(err).toBeNull();
        expect(allowed).toBe(true);
        resolve();
      });
    });

    await new Promise((resolve) => {
      corsOptions.origin('https://blocked.local', (err) => {
        expect(err).toBeInstanceOf(Error);
        resolve();
      });
    });
  });

  test('does not start business metrics collector in test env', async () => {
    const { mocks } = await loadApp();
    expect(mocks.startBusinessMetricsCollectorMock).not.toHaveBeenCalled();
    expect(mocks.httpMetricsMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  test('starts business metrics collector outside test and logs rejection', async () => {
    const failure = new Error('failed to start');
    const { mocks } = await loadApp({
      env: { NODE_ENV: 'production' },
      metricsReject: failure,
    });
    expect(mocks.startBusinessMetricsCollectorMock).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(mocks.loggerWarnMock).toHaveBeenCalledWith(
      'Business metrics collector failed to start: %s',
      failure.message
    );
  });

  test('errorHandler normalises csrf errors and logs warning', async () => {
    const { mod, mocks } = await loadApp();
    const { errorHandler } = mod;

    const res = {};
    const req = { id: 'req-42' };
    const err = new Error('EBADCSRFTOKEN mismatch');

    errorHandler(err, req, res, jest.fn());

    expect(mocks.sendErrorMock).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ status: 403, code: 'EBADCSRFTOKEN' })
    );
    expect(mocks.loggerWarnMock).toHaveBeenCalledWith(
      'Request failed [%s]: %s (%s)',
      'req-42',
      'EBADCSRFTOKEN',
      403
    );
  });

  test('errorHandler logs server errors using logger.error', async () => {
    const { mod, mocks } = await loadApp();
    const { errorHandler } = mod;

    const res = {};
    const req = {};
    const err = Object.assign(new Error('boom'), { status: 500 });

    errorHandler(err, req, res, jest.fn());

    expect(mocks.loggerErrorMock).toHaveBeenCalledWith(
      'Unhandled server error [%s]: %s',
      '-',
      err.stack || err
    );
    expect(mocks.sendErrorMock).toHaveBeenCalledWith(res, err);
  });
});
