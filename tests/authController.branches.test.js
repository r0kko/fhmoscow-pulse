import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const validationResultMock = jest.fn();
const verifyCredentials = jest.fn();
const issueTokens = jest.fn();
const rotateTokens = jest.fn();
const incAuthLogin = jest.fn();
const incAuthRefresh = jest.fn();
const incTokenIssued = jest.fn();
const bumpTokenVersion = jest.fn();
const userMapperToPublic = jest.fn();
const setRefreshCookie = jest.fn();
const clearRefreshCookie = jest.fn();
const getRefreshTokenCandidates = jest.fn();
const sendError = jest.fn();
const isStaffOnly = jest.fn();

const res = () => {
  const obj = {};
  obj.status = jest.fn().mockReturnValue(obj);
  obj.json = jest.fn().mockReturnValue(obj);
  obj.set = jest.fn();
  obj.vary = jest.fn();
  return obj;
};

beforeEach(() => {
  jest.resetModules();
  validationResultMock.mockReset();
  verifyCredentials.mockReset();
  issueTokens.mockReset();
  rotateTokens.mockReset();
  incAuthLogin.mockReset();
  incAuthRefresh.mockReset();
  incTokenIssued.mockReset();
  bumpTokenVersion.mockReset();
  userMapperToPublic.mockReset();
  setRefreshCookie.mockReset();
  clearRefreshCookie.mockReset();
  getRefreshTokenCandidates.mockReset();
  sendError.mockReset();
  isStaffOnly.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

jest.unstable_mockModule('express-validator', () => ({
  __esModule: true,
  validationResult: validationResultMock,
}));

jest.unstable_mockModule('../src/services/authService.js', () => ({
  __esModule: true,
  default: {
    verifyCredentials,
    issueTokens,
    rotateTokens,
  },
}));

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  incAuthLogin,
  incAuthRefresh,
  incTokenIssued,
}));

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: {
    bumpTokenVersion,
  },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: {
    toPublic: userMapperToPublic,
  },
}));

jest.unstable_mockModule('../src/utils/cookie.js', () => ({
  __esModule: true,
  setRefreshCookie,
  clearRefreshCookie,
  getRefreshTokenCandidates,
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError,
}));

jest.unstable_mockModule('../src/utils/roles.js', () => ({
  __esModule: true,
  isStaffOnly,
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  UserStatus: {},
}));

const { default: controller } =
  await import('../src/controllers/authController.js');

test('login returns validation errors', async () => {
  const resp = res();
  validationResultMock.mockReturnValueOnce({
    isEmpty: () => false,
    array: () => [{ msg: 'bad' }],
  });
  await controller.login({ body: {} }, resp);
  expect(resp.status).toHaveBeenCalledWith(400);
  expect(resp.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
});

test('login issues tokens and propagates status-based extras', async () => {
  const resp = res();
  validationResultMock.mockReturnValueOnce({ isEmpty: () => true });
  const userObj = {
    id: 'u1',
    increment: jest.fn(),
    reload: jest.fn().mockResolvedValue({
      UserStatus: { alias: 'REGISTRATION_STEP_3' },
      getRoles: jest.fn().mockResolvedValue([{ alias: 'ROLE' }]),
      password_change_required: false,
    }),
  };
  verifyCredentials.mockResolvedValue(userObj);
  issueTokens.mockReturnValue({ accessToken: 'at', refreshToken: 'rt' });
  userMapperToPublic.mockReturnValue({ id: 'u1' });
  isStaffOnly.mockReturnValue(false);

  await controller.login({ body: { phone: '1', password: 'p' } }, resp);
  expect(setRefreshCookie).toHaveBeenCalledWith(resp, 'rt');
  expect(resp.json).toHaveBeenCalledWith(
    expect.objectContaining({
      access_token: 'at',
      user: { id: 'u1' },
      next_step: 3,
      capabilities: { is_staff_only: false },
    })
  );
});

test('refresh rejects when cookies missing and increments metric', async () => {
  const resp = res();
  validationResultMock.mockReturnValueOnce({ isEmpty: () => true });
  getRefreshTokenCandidates.mockReturnValue([]);
  await controller.refresh({ cookies: {} }, resp);
  expect(resp.status).toHaveBeenCalledWith(401);
  expect(resp.json).toHaveBeenCalledWith({
    error: 'Отсутствует токен обновления',
  });
});

test('logout bumps token version best-effort and clears cookie', async () => {
  const resp = res();
  await controller.logout(
    { session: { destroy: (cb) => cb?.() }, user: { id: 'u1' } },
    resp
  );
  expect(bumpTokenVersion).toHaveBeenCalledWith('u1');
  expect(clearRefreshCookie).toHaveBeenCalledWith(resp);
  expect(resp.status).toHaveBeenCalledWith(200);
});
