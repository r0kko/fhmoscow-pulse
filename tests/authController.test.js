import {expect, jest, test} from '@jest/globals';

const verifyCredentialsMock = jest.fn();
const issueTokensMock = jest.fn(() => ({ accessToken: 'access', refreshToken: 'refresh' }));

jest.unstable_mockModule('../src/services/authService.js', () => ({
  __esModule: true,
  default: { verifyCredentials: verifyCredentialsMock, issueTokens: issueTokensMock },
}));

const setRefreshCookieMock = jest.fn();
jest.unstable_mockModule('../src/utils/cookie.js', () => ({
  __esModule: true,
  setRefreshCookie: setRefreshCookieMock,
  clearRefreshCookie: jest.fn(),
}));

const signAccessTokenMock = jest.fn(() => 'access');
const signRefreshTokenMock = jest.fn(() => 'refresh');
jest.unstable_mockModule('../src/utils/jwt.js', () => ({
  __esModule: true,
  signAccessToken: signAccessTokenMock,
  signRefreshToken: signRefreshTokenMock,
}));

const toPublicMock = jest.fn((u) => {
  // eslint-disable-next-line no-unused-vars
  const { password, ...rest } = u;
  return rest;
});
jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({ isEmpty: () => true })),
}));

const { default: authController } = await import('../src/controllers/authController.js');

// eslint-disable-next-line no-undef
process.env.JWT_SECRET = 'secret';

test('login does not include password in response', async () => {
  const user = {
    id: '1',
    email: 'a@b.c',
    password: 'hash',
  };
  verifyCredentialsMock.mockResolvedValue(user);

  const req = { body: { email: 'a@b.c', password: 'pass' }, cookies: {} };
  const res = { json: jest.fn() };

  await authController.login(req, res);

  const response = res.json.mock.calls[0][0];
  expect(response.user.password).toBeUndefined();
  expect(verifyCredentialsMock).toHaveBeenCalledWith('a@b.c', 'pass');
  expect(setRefreshCookieMock).toHaveBeenCalledWith(res, 'refresh');
});
