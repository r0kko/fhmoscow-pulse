import {
  jest,
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

const onFinishedMock = jest.fn();
const loggerInfoMock = jest.fn();
const loggerWarnMock = jest.fn();
const activeContextMock = jest.fn();
const spanContextMock = jest.fn();
const getSpanMock = jest.fn();

let requestLogger;
let testables;

async function loadModule() {
  jest.resetModules();
  process.env = {
    ...ORIGINAL_ENV,
    LOG_REQUEST_BODY_MAX_BYTES: '40',
    LOG_RESPONSE_BODY_MAX_BYTES: '40',
  };

  onFinishedMock.mockImplementation((res, callback) => callback(res));
  loggerInfoMock.mockReset();
  loggerWarnMock.mockReset();
  activeContextMock.mockReturnValue({});
  spanContextMock.mockReturnValue({ traceId: 'trace-1', spanId: 'span-1' });
  getSpanMock.mockReturnValue({ spanContext: spanContextMock });

  jest.unstable_mockModule('on-finished', () => ({
    __esModule: true,
    default: (res, callback) => onFinishedMock(res, callback),
  }));
  jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    default: {
      info: loggerInfoMock,
      warn: loggerWarnMock,
    },
  }));
  jest.unstable_mockModule('@opentelemetry/api', () => ({
    __esModule: true,
    context: { active: activeContextMock },
    trace: { getSpan: getSpanMock },
  }));

  const mod = await import('../src/middlewares/requestLogger.js');
  requestLogger = mod.default;
  testables = mod.__testables;
}

beforeEach(async () => {
  await loadModule();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('requestLogger middleware', () => {
  test('emits sanitized payload with trace metadata', () => {
    const req = {
      id: 'req-1',
      method: 'POST',
      originalUrl: '/users?password=secret&keep=ok',
      route: { path: '/users' },
      ip: '198.51.100.1',
      user: { id: 'user-1' },
      body: {
        password: 'secret',
        keep: 'value',
        nested: { inn: '12345678909', safe: 'ok' },
      },
      get: jest.fn((name) =>
        name.toLowerCase() === 'user-agent' ? 'Mozilla' : ''
      ),
    };
    const res = {
      statusCode: 200,
      locals: {
        body: {
          access_token: 'should-hide',
          message: 'ok',
        },
        observability: {
          refresh_token: 'secret',
          safe: 'value',
        },
      },
    };
    const next = jest.fn();

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(onFinishedMock).toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'http.audit',
      expect.objectContaining({
        req_id: 'req-1',
        user_id: 'user-1',
        trace_id: 'trace-1',
        span_id: 'span-1',
        request_body: expect.objectContaining({ keep: 'value' }),
        response_body: expect.objectContaining({ message: 'ok' }),
      })
    );
    const payload = loggerInfoMock.mock.calls[0][1];
    expect(payload.request_body).not.toHaveProperty('password');
    expect(payload.request_body.nested).not.toHaveProperty('inn');
    expect(payload.response_body).not.toHaveProperty('access_token');
    expect(payload.tags).toEqual({ safe: 'value' });
  });

  test('logs warning when info call throws', () => {
    loggerInfoMock.mockImplementation(() => {
      throw new Error('fail');
    });
    const req = { method: 'GET', originalUrl: '/', get: jest.fn(() => '') };
    const res = { statusCode: 500, locals: {} };

    requestLogger(req, res, jest.fn());

    expect(loggerWarnMock).toHaveBeenCalled();
  });

  test('utility helpers redact and normalize sensitive data', () => {
    const { maskUrl, clampJsonBytes, normalizeObjectOrNull, redact } =
      testables;
    expect(maskUrl('/path?token=abc&safe=1')).toBe(
      '/path?token=redacted&safe=1'
    );
    expect(maskUrl('not a url')).toBe('not a url');

    const truncated = clampJsonBytes({ huge: 'x'.repeat(100) }, 10);
    expect(truncated).toEqual({
      truncated: true,
      approx_size_bytes: expect.any(Number),
    });

    expect(normalizeObjectOrNull({})).toBeNull();
    expect(normalizeObjectOrNull({ foo: 'bar' })).toEqual({ foo: 'bar' });

    const redacted = redact({ password: 'secret', safe: 'ok' });
    expect(redacted).toEqual({ safe: 'ok' });
  });
});
