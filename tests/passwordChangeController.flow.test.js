import { beforeEach, expect, jest, test } from '@jest/globals';

let validationImpl;
const scopeMock = jest.fn();
const findByPkMock = jest.fn();
const resetPasswordMock = jest.fn();
const bumpTokenVersionMock = jest.fn();
const issueTokensMock = jest.fn();
const toPublicMock = jest.fn();
const setRefreshCookieMock = jest.fn();
const sendErrorMock = jest.fn();
const compareMock = jest.fn();

async function loadController() {
  const mod = await import('../src/controllers/passwordChangeController.js');
  return mod.default;
}

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

beforeEach(() => {
  jest.resetModules();
  validationImpl = () => ({
    isEmpty: () => true,
    array: () => [],
  });
  scopeMock.mockReset().mockReturnValue({ findByPk: findByPkMock });
  findByPkMock.mockReset();
  resetPasswordMock.mockReset();
  bumpTokenVersionMock.mockReset();
  issueTokensMock.mockReset();
  toPublicMock.mockReset();
  setRefreshCookieMock.mockReset();
  sendErrorMock.mockReset();
  compareMock.mockReset();

  jest.unstable_mockModule('express-validator', () => ({
    __esModule: true,
    validationResult: (...args) => validationImpl(...args),
  }));

  jest.unstable_mockModule('bcryptjs', () => ({
    __esModule: true,
    default: { compare: compareMock },
  }));

  jest.unstable_mockModule('../src/models/user.js', () => ({
    __esModule: true,
    default: { scope: scopeMock },
  }));

  jest.unstable_mockModule('../src/services/userService.js', () => ({
    __esModule: true,
    default: {
      resetPassword: resetPasswordMock,
      bumpTokenVersion: bumpTokenVersionMock,
    },
  }));

  jest.unstable_mockModule('../src/services/authService.js', () => ({
    __esModule: true,
    default: { issueTokens: issueTokensMock },
  }));

  jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
    __esModule: true,
    default: { toPublic: toPublicMock },
  }));

  jest.unstable_mockModule('../src/utils/cookie.js', () => ({
    __esModule: true,
    setRefreshCookie: setRefreshCookieMock,
  }));

  jest.unstable_mockModule('../src/utils/api.js', () => ({
    __esModule: true,
    sendError: sendErrorMock,
  }));
});

test('changeSelf rejects when user is missing', async () => {
  findByPkMock.mockResolvedValue(null);
  const controller = await loadController();
  const req = {
    body: { current_password: 'old', new_password: 'newPass123' },
    user: { id: 'u1' },
  };
  const res = createRes();

  await controller.changeSelf(req, res);

  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'user_not_found' });
  expect(resetPasswordMock).not.toHaveBeenCalled();
});

test('changeSelf rejects invalid current password', async () => {
  const user = {
    id: 'u1',
    password: 'hash',
    update: jest.fn(),
    reload: jest.fn(),
    getRoles: jest.fn(),
  };
  findByPkMock.mockResolvedValue(user);
  compareMock.mockResolvedValue(false);
  const controller = await loadController();
  const req = {
    body: { current_password: 'wrong', new_password: 'Pass123!' },
    user: { id: 'u1' },
  };
  const res = createRes();

  await controller.changeSelf(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'invalid_current_password' });
  expect(resetPasswordMock).not.toHaveBeenCalled();
  expect(setRefreshCookieMock).not.toHaveBeenCalled();
});

test('changeSelf updates password, issues tokens, and returns public user', async () => {
  const user = {
    id: 'u1',
    password: 'hash',
    update: jest.fn().mockResolvedValue(),
    reload: jest.fn(),
    getRoles: jest.fn(),
  };
  user.reload.mockResolvedValue(user);
  user.getRoles.mockResolvedValue([{ alias: 'ADMIN' }, { alias: 'COACH' }]);
  findByPkMock.mockResolvedValue(user);
  compareMock.mockResolvedValue(true);
  resetPasswordMock.mockResolvedValue();
  bumpTokenVersionMock.mockResolvedValue();
  issueTokensMock.mockReturnValue({
    accessToken: 'access',
    refreshToken: 'refresh',
  });
  toPublicMock.mockReturnValue({ id: 'u1', email: 'coach@test' });

  const controller = await loadController();
  const req = {
    body: { current_password: 'OldPass1!', new_password: 'NewPass2!' },
    user: { id: 'u1' },
  };
  const res = createRes();

  await controller.changeSelf(req, res);

  expect(compareMock).toHaveBeenCalledWith('OldPass1!', 'hash');
  expect(resetPasswordMock).toHaveBeenCalledWith('u1', 'NewPass2!', 'u1');
  expect(user.update).toHaveBeenCalledWith({ password_change_required: false });
  expect(bumpTokenVersionMock).toHaveBeenCalledWith('u1');
  expect(setRefreshCookieMock).toHaveBeenCalledWith(res, 'refresh');
  expect(res.json).toHaveBeenCalledWith({
    access_token: 'access',
    user: { id: 'u1', email: 'coach@test' },
    roles: ['ADMIN', 'COACH'],
  });
});

test('changeSelf delegates unexpected errors to sendError helper', async () => {
  const error = new Error('boom');
  const user = {
    id: 'u1',
    password: 'hash',
    update: jest.fn().mockResolvedValue(),
    reload: jest.fn().mockResolvedValue({
      getRoles: jest.fn().mockResolvedValue([]),
    }),
    getRoles: jest.fn().mockResolvedValue([]),
  };
  findByPkMock.mockResolvedValue(user);
  compareMock.mockResolvedValue(true);
  resetPasswordMock.mockRejectedValue(error);
  sendErrorMock.mockImplementation(() => ({
    status: () => {},
    json: () => {},
  }));

  const controller = await loadController();
  const req = {
    body: { current_password: 'OldPass1!', new_password: 'NewPass2!' },
    user: { id: 'u1' },
  };
  const res = createRes();

  await controller.changeSelf(req, res);

  expect(sendErrorMock).toHaveBeenCalledWith(res, error);
});

test('changeSelf propagates generic validation errors structure', async () => {
  validationImpl = () => ({
    isEmpty: () => false,
    array: () => [{ path: 'field', msg: 'required' }],
  });
  const controller = await loadController();
  const req = { body: {}, user: { id: 'u1' } };
  const res = createRes();

  await controller.changeSelf(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({
    errors: [{ path: 'field', msg: 'required' }],
  });
});
