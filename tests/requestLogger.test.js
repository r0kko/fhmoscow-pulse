import {expect, jest, test} from '@jest/globals';

const createMock = jest.fn();
const uuidMock = jest.fn(() => 'id');
const onFinishedMock = jest.fn((res, cb) => cb());
const warnMock = jest.fn();

jest.unstable_mockModule('../src/models/log.js', () => ({
  __esModule: true,
  default: { create: createMock },
}));

jest.unstable_mockModule('uuid', () => ({
  __esModule: true,
  v4: uuidMock,
}));

jest.unstable_mockModule('on-finished', () => ({
  __esModule: true,
  default: onFinishedMock,
}));

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: { warn: warnMock },
}));

const { default: requestLogger } = await import('../src/middlewares/requestLogger.js');

test('persists log entry on finish', async () => {
  const req = { method: 'GET', originalUrl: '/x', ip: '::1', get: () => 'ua', body: {foo:'bar'} };
  const res = { statusCode: 200, locals: { body: 'ok' } };
  const next = jest.fn();

  await requestLogger(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(onFinishedMock).toHaveBeenCalledWith(res, expect.any(Function));
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'id',
      method: 'GET',
      path: '/x',
      status_code: 200,
      ip: '::1',
      user_agent: 'ua',
      request_body: { foo: 'bar' },
      response_body: 'ok',
    }),
    { logging: false },
  );
});

test('omits sensitive fields from request body', async () => {
  const req = {
    method: 'POST',
    originalUrl: '/login',
    ip: '::1',
    get: () => 'ua',
    body: { foo: 'bar', password: 'secret', refresh_token: 'r' },
  };
  const res = { statusCode: 200, locals: {} };

  await requestLogger(req, res, () => {});

  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({ request_body: { foo: 'bar' } }),
    { logging: false },
  );
  expect(req.body.password).toBe('secret');
  expect(req.body.refresh_token).toBe('r');
});

test('stores null when only sensitive fields present', async () => {
  createMock.mockClear();
  const req = {
    method: 'POST',
    originalUrl: '/login',
    ip: '::1',
    get: () => 'ua',
    body: { password: 'secret', refresh_token: 'r' },
  };
  const res = { statusCode: 200, locals: {} };

  await requestLogger(req, res, () => {});

  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({ request_body: null }),
    { logging: false },
  );
});

test('logs warning when create fails', async () => {
  createMock.mockRejectedValueOnce(new Error('fail'));
  const req = { method: 'GET', originalUrl: '/x', ip: '::1', get: () => 'ua', body: {} };
  const res = { statusCode: 200, locals: {} };

  await requestLogger(req, res, () => {});

  expect(warnMock).toHaveBeenCalled();
});
