import { expect, jest, test } from '@jest/globals';

const csrfMock = jest.fn((_req, _res, next) => next());

jest.unstable_mockModule('../src/config/csrf.js', () => ({
  __esModule: true,
  default: csrfMock,
}));

const { default: csrfMiddleware } = await import('../src/middlewares/csrf.js');

function buildRes() {
  return {};
}

function buildReq(path = '/') {
  return { path };
}

test('delegates to csrf for normal paths', () => {
  const req = buildReq('/login');
  const res = buildRes();
  const next = jest.fn();
  csrfMiddleware(req, res, next);
  expect(csrfMock).toHaveBeenCalledWith(req, res, next);
});

test('bypasses middleware for exempt paths', () => {
  csrfMock.mockClear();
  for (const p of [
    '/csrf-token',
    '/auth/login',
    '/auth/logout',
    '/auth/refresh',
  ]) {
    const req = buildReq(p);
    const res = buildRes();
    const next = jest.fn();
    csrfMiddleware(req, res, next);
    expect(csrfMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    csrfMock.mockClear();
  }
});
