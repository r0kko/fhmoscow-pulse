import { expect, jest, test, beforeEach } from '@jest/globals';

const infoMock = jest.fn();
const warnMock = jest.fn();
const onFinishedMock = jest.fn((res, cb) => cb());

jest.unstable_mockModule('on-finished', () => ({
  __esModule: true,
  default: onFinishedMock,
}));

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: {
    info: infoMock,
    warn: warnMock,
  },
}));

const { default: requestLogger } = await import(
  '../src/middlewares/requestLogger.js'
);

beforeEach(() => {
  jest.clearAllMocks();
});

test('emits structured audit log on finish', async () => {
  const req = {
    id: 'req-1',
    method: 'GET',
    originalUrl: '/x',
    ip: '::1',
    get: () => 'ua',
    body: { foo: 'bar' },
  };
  const res = { statusCode: 200, locals: { body: 'ok' } };

  await requestLogger(req, res, () => {});

  expect(onFinishedMock).toHaveBeenCalledWith(res, expect.any(Function));
  expect(infoMock).toHaveBeenCalledWith(
    'http.audit',
    expect.objectContaining({
      req_id: 'req-1',
      method: 'GET',
      path: '/x',
      status_code: 200,
      ip: '::1',
      user_agent: 'ua',
      request_body: { foo: 'bar' },
      response_body: 'ok',
    })
  );
});

test('omits sensitive fields and keeps original body intact', async () => {
  const body = { foo: 'bar', password: 'secret', refresh_token: 'r' };
  const req = {
    method: 'POST',
    originalUrl: '/login',
    ip: '::1',
    get: () => 'ua',
    body,
  };
  const res = { statusCode: 200, locals: {} };

  await requestLogger(req, res, () => {});

  expect(infoMock).toHaveBeenCalledWith(
    'http.audit',
    expect.objectContaining({ request_body: { foo: 'bar' } })
  );
  expect(body.password).toBe('secret');
  expect(body.refresh_token).toBe('r');
});

test('stores null when only sensitive fields present', async () => {
  const req = {
    method: 'POST',
    originalUrl: '/login',
    ip: '::1',
    get: () => 'ua',
    body: { password: 'secret', refresh_token: 'r' },
  };
  const res = { statusCode: 200, locals: {} };

  await requestLogger(req, res, () => {});

  expect(infoMock).toHaveBeenCalledWith(
    'http.audit',
    expect.objectContaining({ request_body: null })
  );
});

test('logs warning when audit emission fails', async () => {
  infoMock.mockImplementationOnce(() => {
    throw new Error('fail');
  });
  const req = {
    method: 'GET',
    originalUrl: '/x',
    ip: '::1',
    get: () => 'ua',
    body: {},
  };
  const res = { statusCode: 200, locals: {} };

  await requestLogger(req, res, () => {});

  expect(warnMock).toHaveBeenCalledWith(
    'Failed to emit http audit log: %s',
    'fail'
  );
});
