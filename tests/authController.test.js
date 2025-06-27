import { describe, expect, jest, test } from '@jest/globals';

const verifyCredentialsMock = jest.fn();
const rotateTokensMock = jest.fn();
const issueTokensMock = jest.fn(() => ({
  accessToken: 'access',
  refreshToken: 'refresh',
}));

jest.unstable_mockModule('../src/services/authService.js', () => ({
  __esModule: true,
  default: {
    verifyCredentials: verifyCredentialsMock,
    rotateTokens: rotateTokensMock,
    issueTokens: issueTokensMock,
  },
}));

const setRefreshCookieMock = jest.fn();
const clearRefreshCookieMock = jest.fn();
jest.unstable_mockModule('../src/utils/cookie.js', () => ({
  __esModule: true,
  setRefreshCookie: setRefreshCookieMock,
  clearRefreshCookie: clearRefreshCookieMock,
}));

const signAccessTokenMock = jest.fn(() => 'access');
const signRefreshTokenMock = jest.fn(() => 'refresh');
jest.unstable_mockModule('../src/utils/jwt.js', () => ({
  __esModule: true,
  signAccessToken: signAccessTokenMock,
  signRefreshToken: signRefreshTokenMock,
}));

const toPublicMock = jest.fn((u) => {
  const {
    password: _p,
    createdAt: _ca,
    updatedAt: _ua,
    deletedAt: _da,
    getRoles: _gr,
    UserStatus: us,
    ...rest
  } = u;
  void _p;
  void _ca;
  void _ua;
  void _da;
  void _gr;
  if (us) {
    rest.status = us.alias;
  }
  return rest;
});
jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

let validationOk = true;
jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const { default: authController } = await import('../src/controllers/authController.js');

// eslint-disable-next-line no-undef
process.env.JWT_SECRET = 'secret';

describe('authController', () => {

test('login does not include sensitive fields in response', async () => {
  const user = {
    id: '1',
    phone: '123',
    password: 'hash',
    createdAt: 't',
    updatedAt: 't',
    deletedAt: null,
    getRoles: jest.fn().mockResolvedValue([{ alias: 'ADMIN' }]),
    reload: jest.fn().mockResolvedValue({
      id: '1',
      getRoles: jest.fn().mockResolvedValue([{ alias: 'ADMIN' }]),
      UserStatus: { alias: 'ACTIVE' },
    }),
  };
  verifyCredentialsMock.mockResolvedValue(user);

  const req = { body: { phone: '123', password: 'pass' }, cookies: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await authController.login(req, res);

  const response = res.json.mock.calls[0][0];
  expect(response.user.password).toBeUndefined();
  expect(response.user.createdAt).toBeUndefined();
  expect(response.user.updatedAt).toBeUndefined();
  expect(response.user.deletedAt).toBeUndefined();
  expect(Array.isArray(response.roles)).toBe(true);
  expect(verifyCredentialsMock).toHaveBeenCalledWith('123', 'pass');
  expect(user.reload).toHaveBeenCalled();
  expect(setRefreshCookieMock).toHaveBeenCalledWith(res, 'refresh');
});

test('login validation failure returns 400', async () => {
  validationOk = false;
  const req = { body: {}, cookies: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await authController.login(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
  validationOk = true;
});

test('login returns next_step when registration not complete', async () => {
  const user = {
    id: '1',
    getRoles: jest.fn().mockResolvedValue([{ alias: 'USER' }]),
    reload: jest.fn().mockResolvedValue({
      id: '1',
      getRoles: jest.fn().mockResolvedValue([{ alias: 'USER' }]),
      UserStatus: { alias: 'REGISTRATION_STEP_3' },
    }),
  };
  verifyCredentialsMock.mockResolvedValue(user);

  const req = { body: { phone: '1', password: 'p' }, cookies: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await authController.login(req, res);

  expect(res.json).toHaveBeenCalledWith({
    access_token: 'access',
    user: { id: '1', status: 'REGISTRATION_STEP_3' },
    roles: ['USER'],
    next_step: 3,
  });
});

test('login returns awaiting_confirmation flag', async () => {
  const user = {
    id: '2',
    getRoles: jest.fn().mockResolvedValue([{ alias: 'USER' }]),
    reload: jest.fn().mockResolvedValue({
      id: '2',
      getRoles: jest.fn().mockResolvedValue([{ alias: 'USER' }]),
      UserStatus: { alias: 'AWAITING_CONFIRMATION' },
    }),
  };
  verifyCredentialsMock.mockResolvedValue(user);

  const req = { body: { phone: '2', password: 'p' }, cookies: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await authController.login(req, res);

  expect(res.json).toHaveBeenCalledWith({
    access_token: 'access',
    user: { id: '2', status: 'AWAITING_CONFIRMATION' },
    roles: ['USER'],
    awaiting_confirmation: true,
  });
});

test('logout clears refresh cookie', async () => {
  const req = {};
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await authController.logout(req, res);

  expect(clearRefreshCookieMock).toHaveBeenCalledWith(res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ message: 'Logged out' });
});

test('me returns sanitized user with status', async () => {
  const loaded = {
    id: '1',
    getRoles: jest.fn().mockResolvedValue([{ alias: 'ADMIN' }]),
    UserStatus: { alias: 'AWAITING_CONFIRMATION' },
  };
  const req = {
    user: {
      reload: jest.fn().mockResolvedValue(loaded),
    },
  };
  const res = { json: jest.fn() };

  await authController.me(req, res);

  expect(req.user.reload).toHaveBeenCalled();
  expect(toPublicMock).toHaveBeenCalledWith(loaded);
  expect(res.json).toHaveBeenCalledWith({
    user: { id: '1', status: 'AWAITING_CONFIRMATION' },
    roles: ['ADMIN'],
  });
});

test('refresh returns new tokens when valid', async () => {
  const user = { id: '1', getRoles: jest.fn().mockResolvedValue([{ alias: 'ADMIN' }]) };
  rotateTokensMock.mockResolvedValue({
    user,
    accessToken: 'a',
    refreshToken: 'r',
  });

  const req = { cookies: { refresh_token: 'r' }, body: {} };
  const res = { json: jest.fn() };

  await authController.refresh(req, res);

  expect(rotateTokensMock).toHaveBeenCalledWith('r');
  expect(setRefreshCookieMock).toHaveBeenCalledWith(res, 'r');
  expect(res.json).toHaveBeenCalledWith({
    access_token: 'a',
    user: { id: '1' },
    roles: ['ADMIN'],
  });
});

test('refresh missing token returns 401', async () => {
  const req = { cookies: {}, body: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await authController.refresh(req, res);

  expect(res.status).toHaveBeenCalledWith(401);
});

test('refresh invalid token returns 401', async () => {
  rotateTokensMock.mockRejectedValue(new Error('bad'));
  const req = { cookies: { refresh_token: 'x' }, body: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await authController.refresh(req, res);

  expect(res.status).toHaveBeenCalledWith(401);
});
});
