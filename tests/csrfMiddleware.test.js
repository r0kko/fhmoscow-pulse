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

function buildReq(path = '/', method = 'GET') {
  return { path, method };
}

test('delegates to csrf for normal unsafe requests', () => {
  const req = buildReq('/login', 'POST');
  const res = buildRes();
  const next = jest.fn();
  csrfMiddleware(req, res, next);
  expect(csrfMock).toHaveBeenCalledWith(req, res, next);
});

test('bypasses middleware for exempt and safe requests', () => {
  csrfMock.mockClear();
  // Exempt path
  let req = buildReq('/csrf-token', 'GET');
  let res = buildRes();
  let next = jest.fn();
  csrfMiddleware(req, res, next);
  expect(csrfMock).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
  csrfMock.mockClear();

  // Safe method should bypass
  req = buildReq('/any', 'GET');
  res = buildRes();
  next = jest.fn();
  csrfMiddleware(req, res, next);
  expect(csrfMock).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
});
