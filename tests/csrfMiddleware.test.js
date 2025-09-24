import { jest, describe, expect, test, beforeEach } from '@jest/globals';

const csrfMock = jest.fn((req, res, next) => next());
const verifyCsrfHmacMock = jest.fn();
const incAcceptedMock = jest.fn();
const incRejectedMock = jest.fn();

jest.unstable_mockModule('../src/config/csrf.js', () => ({
  __esModule: true,
  default: csrfMock,
}));
jest.unstable_mockModule('../src/utils/csrfHmac.js', () => ({
  __esModule: true,
  verifyCsrfHmac: verifyCsrfHmacMock,
}));
jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  incCsrfAccepted: incAcceptedMock,
  incCsrfRejected: incRejectedMock,
}));

const { default: csrfMiddleware } = await import('../src/middlewares/csrf.js');

const buildReq = (overrides = {}) => ({
  method: 'POST',
  path: '/submit',
  headers: {},
  cookies: {},
  get(name) {
    return this.headers[name];
  },
  ...overrides,
});

const buildRes = () => ({ headers: {} });

beforeEach(() => {
  csrfMock.mockReset().mockImplementation((req, res, next) => next());
  verifyCsrfHmacMock.mockReset();
  incAcceptedMock.mockReset();
  incRejectedMock.mockReset();
});

describe('csrfMiddleware', () => {
  test('delegates to csrf for normal unsafe requests', () => {
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn();

    csrfMiddleware(req, res, next);

    expect(csrfMock).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('bypasses middleware for exempt and safe requests', () => {
    const res = buildRes();
    const next = jest.fn();

    csrfMiddleware(buildReq({ path: '/csrf-token', method: 'GET' }), res, next);
    csrfMiddleware(buildReq({ method: 'GET' }), res, next);

    expect(csrfMock).not.toHaveBeenCalled();
    expect(incAcceptedMock).toHaveBeenCalledWith('skipped_safe');
    expect(next).toHaveBeenCalledTimes(2);
  });

  test('skips Bearer-token requests and records metric', () => {
    const req = buildReq({
      headers: { authorization: 'Bearer token123' },
    });
    const res = buildRes();
    const next = jest.fn();

    csrfMiddleware(req, res, next);

    expect(csrfMock).not.toHaveBeenCalled();
    expect(incAcceptedMock).toHaveBeenCalledWith('skipped_bearer');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('accepts valid HMAC token without hitting cookie fallback', () => {
    verifyCsrfHmacMock.mockReturnValue(true);
    const req = buildReq({
      headers: { 'X-XSRF-TOKEN': 'signed-token' },
    });
    const res = buildRes();
    const next = jest.fn();

    csrfMiddleware(req, res, next);

    expect(verifyCsrfHmacMock).toHaveBeenCalledWith('signed-token', req);
    expect(incAcceptedMock).toHaveBeenCalledWith('hmac');
    expect(csrfMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('falls back to legacy double-submit cookies', () => {
    verifyCsrfHmacMock.mockReturnValue(false);
    const req = buildReq({
      headers: { 'X-CSRF-TOKEN': 'legacy-token' },
      cookies: {
        'XSRF-TOKEN-API': 'legacy-token',
      },
    });
    const res = buildRes();
    const next = jest.fn();

    csrfMiddleware(req, res, next);

    expect(incAcceptedMock).toHaveBeenCalledWith('double_submit_legacy');
    expect(csrfMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('records rejection metrics when csrf validation fails', () => {
    const error = new Error('EBADCSRFTOKEN: missing');
    verifyCsrfHmacMock.mockImplementation(() => {
      throw new Error('unexpected');
    });
    csrfMock.mockImplementation((_req, _res, handler) => handler(error));

    const req = buildReq({ headers: { 'X-CSRFToken': 'bad' } });
    const res = buildRes();
    const next = jest.fn();

    csrfMiddleware(req, res, next);

    expect(incRejectedMock).toHaveBeenCalledWith('hmac_error');
    expect(incRejectedMock).toHaveBeenCalledWith('cookie_missing_or_mismatch');
    expect(next).toHaveBeenCalledWith(error);
  });
});
