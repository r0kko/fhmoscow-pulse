import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const findOneMock = jest.fn();
const verifyCodeMock = jest.fn();
const resetPasswordMock = jest.fn();
const toPublicMock = jest.fn(() => ({ id: '1' }));
const issueTokensMock = jest.fn(() => ({ accessToken: 'a', refreshToken: 'r' }));
const setRefreshCookieMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findOne: findOneMock },
  ExternalSystem: {},
  UserExternalId: {},
}));

jest.unstable_mockModule('../src/services/authService.js', () => ({
  __esModule: true,
  default: { issueTokens: issueTokensMock },
}));

jest.unstable_mockModule('../src/utils/cookie.js', () => ({
  __esModule: true,
  setRefreshCookie: setRefreshCookieMock,
}));

jest.unstable_mockModule('../src/services/emailVerificationService.js', () => ({
  __esModule: true,
  default: { verifyCode: verifyCodeMock },
}));

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { resetPassword: resetPasswordMock },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

const { default: controller } = await import('../src/controllers/registrationController.js');

test('finish validation failure returns 400', async () => {
  validationOk = false;
  const req = { body: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.finish(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
  validationOk = true;
});

test('finish verifies code and resets password', async () => {
  const user = {
    id: '1',
    reload: jest.fn().mockResolvedValue({
      id: '1',
      getRoles: jest.fn().mockResolvedValue([]),
    }),
    getRoles: jest.fn().mockResolvedValue([]),
  };
  findOneMock.mockResolvedValue(user);
  const req = { body: { email: 'e', code: 'c', password: 'Pa55word' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

  await controller.finish(req, res);

  expect(findOneMock).toHaveBeenCalledWith({ where: { email: 'e' } });
  expect(verifyCodeMock).toHaveBeenCalledWith(user, 'c', 'REGISTRATION_STEP_1');
  expect(resetPasswordMock).toHaveBeenCalledWith('1', 'Pa55word');
  expect(issueTokensMock).toHaveBeenCalledWith(
    expect.objectContaining({ id: '1' })
  );
  expect(setRefreshCookieMock).toHaveBeenCalledWith(res, 'r');
  expect(toPublicMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({
    access_token: 'a',
    user: { id: '1' },
    roles: [],
  });
});
