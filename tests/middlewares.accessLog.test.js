import { afterEach, describe, expect, jest, test } from '@jest/globals';

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value) {
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }
}

describe('accessLog middleware', () => {
  let accessLog;
  let capturedFormat;
  let tokenMock;
  let morganDefault;
  let mockMiddleware;
  let otelMocks;

  async function loadModule(env = 'production') {
    setNodeEnv(env);
    jest.resetModules();
    capturedFormat = undefined;
    mockMiddleware = jest.fn((_req, _res, next) => next?.());
    tokenMock = jest.fn();
    morganDefault = jest.fn((format) => {
      capturedFormat = format;
      return mockMiddleware;
    });
    morganDefault.token = tokenMock;

    const contextActiveMock = jest.fn(() => ({ trace: 'ctx' }));
    const spanContextMock = jest.fn(() => ({
      traceId: 'trace-id',
      spanId: 'span-id',
    }));
    const getSpanMock = jest.fn(() => ({ spanContext: spanContextMock }));
    otelMocks = { contextActiveMock, getSpanMock, spanContextMock };

    jest.unstable_mockModule('morgan', () => ({
      __esModule: true,
      default: morganDefault,
    }));

    jest.unstable_mockModule('@opentelemetry/api', () => ({
      __esModule: true,
      context: { active: contextActiveMock },
      trace: { getSpan: getSpanMock },
    }));

    ({ default: accessLog } = await import('../src/middlewares/accessLog.js'));
  }

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
  });

  test('returns no-op middleware when NODE_ENV is test', async () => {
    await loadModule('test');

    expect(tokenMock).toHaveBeenCalledTimes(3);
    expect(tokenMock.mock.calls.map((call) => call[0])).toEqual([
      'reqid',
      'route',
      'errorcode',
    ]);
    expect(morganDefault).not.toHaveBeenCalled();

    const middleware = accessLog();
    const next = jest.fn();
    middleware({}, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('uses morgan JSON formatter outside test environment', async () => {
    await loadModule('production');

    const middleware = accessLog();
    expect(morganDefault).toHaveBeenCalledTimes(1);
    expect(middleware).toBe(mockMiddleware);
    expect(typeof capturedFormat).toBe('function');

    const req = {
      id: 'req-1',
      headers: {
        'cf-connecting-ip': '198.51.100.10',
        'cf-ray': 'traceRay',
        'cf-ipcountry': 'RU',
        'user-agent': 'Mozilla/5.0',
        host: 'example.test',
      },
      ip: '10.1.2.3',
      connection: { remoteAddress: '192.0.2.33' },
    };
    const res = {
      getHeader: jest.fn(() => 'E-001'),
    };
    const tokens = {
      date: jest.fn(() => '2024-11-05T10:00:00.000Z'),
      method: jest.fn(() => 'GET'),
      url: jest.fn(() => '/api/users?offset=0'),
      route: jest.fn(() => '/api/users'),
      status: jest.fn(() => '200'),
      res: jest.fn((_req, _res, field) =>
        field === 'content-length' ? '1024' : '0'
      ),
      'response-time': jest.fn(() => '42'),
      'remote-addr': jest.fn(() => '203.0.113.4'),
      'user-agent': jest.fn(() => 'curl/8.0'),
      referrer: jest.fn(() => 'https://ref.example'),
      reqid: jest.fn(() => 'req-1'),
      errorcode: jest.fn(() => 'BUSY'),
    };

    const output = capturedFormat(tokens, req, res);
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      type: 'access',
      ts: '2024-11-05T10:00:00.000Z',
      req_id: 'req-1',
      method: 'GET',
      path: '/api/users?offset=0',
      route: '/api/users',
      status: 200,
      status_class: '2xx',
      length: 1024,
      rt_ms: 42,
      ip: '203.0.113.4',
      client_ip: '198.51.100.10',
      ua: 'curl/8.0',
      ref: 'https://ref.example',
      error_code: 'BUSY',
      cf_ray: 'traceRay',
      cf_country: 'RU',
      trace_id: 'trace-id',
      span_id: 'span-id',
    });
    expect(otelMocks.getSpanMock).toHaveBeenCalled();
    expect(otelMocks.spanContextMock).toHaveBeenCalled();
  });

  test('derives client_ip from fallback headers', async () => {
    await loadModule('production');

    accessLog();

    const req = {
      headers: {
        'x-real-ip': '203.0.113.77',
      },
      connection: { remoteAddress: '10.10.0.1' },
    };
    const res = {
      getHeader: jest.fn(() => ''),
    };
    const tokens = {
      date: jest.fn(() => '2024-11-05T10:00:00.000Z'),
      method: jest.fn(() => 'POST'),
      url: jest.fn(() => '/submit'),
      route: jest.fn(() => 'unmatched'),
      status: jest.fn(() => ''),
      res: jest.fn(() => ''),
      'response-time': jest.fn(() => ''),
      'remote-addr': jest.fn(() => ''),
      'user-agent': jest.fn(() => ''),
      referrer: jest.fn(() => ''),
      reqid: jest.fn(() => '-'),
      errorcode: jest.fn(() => ''),
    };

    const output = capturedFormat(tokens, req, res);
    const parsed = JSON.parse(output);

    expect(parsed.status).toBe(0);
    expect(parsed.status_class).toBe('0xx');
    expect(parsed.client_ip).toBe('203.0.113.77');
    expect(parsed.error_code).toBeUndefined();
  });
});
