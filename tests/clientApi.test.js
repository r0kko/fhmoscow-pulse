import { beforeEach, expect, jest, test } from '@jest/globals';

// mock auth module to monitor clearAuth
const clearAuthMock = jest.fn();

jest.unstable_mockModule('../client/src/auth.js', () => ({
  __esModule: true,
  clearAuth: clearAuthMock,
}));

// prepare globals
global.fetch = jest.fn();
// jsdom not available, emulate minimal window
global.window = { location: { href: '' } };

const { apiFetch, setAccessToken, clearAccessToken } = await import('../client/src/api.js');

beforeEach(() => {
  fetch.mockReset();
  clearAuthMock.mockClear();
  window.location.href = '';
  clearAccessToken();
});

test('refresh token and retry on 401', async () => {
  setAccessToken('old');
  fetch
    .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'new' }) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });

  const data = await apiFetch('/foo');

  expect(fetch).toHaveBeenNthCalledWith(1, 'http://localhost:3000/foo', expect.any(Object));
  expect(fetch).toHaveBeenNthCalledWith(2, 'http://localhost:3000/auth/refresh', expect.any(Object));
  expect(fetch).toHaveBeenNthCalledWith(3, 'http://localhost:3000/foo', expect.any(Object));
  expect(data).toEqual({ ok: true });
});

test('redirect to login when refresh fails', async () => {
  fetch
    .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
    .mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({}) });

  await expect(apiFetch('/foo')).rejects.toThrow('Ошибка запроса, код 401');
  expect(clearAuthMock).toHaveBeenCalled();
  expect(window.location.href).toBe('/login');
});
