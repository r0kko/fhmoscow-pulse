import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const sendCodeMock = jest.fn();
const verifyCodeMock = jest.fn();

jest.unstable_mockModule('../src/services/emailVerificationService.js', () => ({
  __esModule: true,
  default: { sendCode: sendCodeMock, verifyCode: verifyCodeMock },
}));

const findLegacyMock = jest.fn();

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findByEmail: findLegacyMock },
}));

const createUserMock = jest.fn();
const resetPasswordMock = jest.fn();

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { createUser: createUserMock, resetPassword: resetPasswordMock },
}));

const fetchPassportMock = jest.fn();

const fetchBankMock = jest.fn();

const fetchAddressMock = jest.fn();

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: { fetchFromLegacy: fetchPassportMock },
}));

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: { fetchFromLegacy: fetchBankMock },
}));

jest.unstable_mockModule('../src/services/addressService.js', () => ({
  __esModule: true,
  default: { fetchFromLegacy: fetchAddressMock },
}));


const issueTokensMock = jest.fn(() => ({
  accessToken: 'a',
  refreshToken: 'r',
}));

jest.unstable_mockModule('../src/services/authService.js', () => ({
  __esModule: true,
  default: { issueTokens: issueTokensMock },
}));

const setRefreshCookieMock = jest.fn();

jest.unstable_mockModule('../src/utils/cookie.js', () => ({
  __esModule: true,
  setRefreshCookie: setRefreshCookieMock,
}));

const toPublicMock = jest.fn((u) => ({ id: u.id }));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

const findUserMock = jest.fn();
const findSystemMock = jest.fn();
const createExtMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findOne: findUserMock },
  ExternalSystem: { findOne: findSystemMock },
  UserExternalId: { create: createExtMock },
}));

const { default: controller } = await import(
  '../src/controllers/registrationController.js'
);

function createRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

test('start returns code_sent when data is valid', async () => {
  const legacyUser = {
    id: 1,
    last_name: 'L',
    first_name: 'F',
    second_name: 'P',
    b_date: '2000-01-01',
    phone_cod: '99',
    phone_number: '1234567',
  };
  findUserMock.mockResolvedValueOnce(null); // no existing
  findLegacyMock.mockResolvedValueOnce(legacyUser);
  createUserMock.mockResolvedValueOnce({ id: 'u1' });
  findSystemMock.mockResolvedValueOnce(null);
  const req = { body: { email: 't@example.com' } };
  const res = createRes();
  await controller.start(req, res);
  expect(createUserMock).toHaveBeenCalled();
  expect(sendCodeMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ message: 'code_sent' });
});

test('start returns 400 on validation errors', async () => {
  validationOk = false;
  const req = { body: {} };
  const res = createRes();
  await controller.start(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
  validationOk = true;
});

test('finish issues tokens after valid code', async () => {
  const user = { id: 'u1', reload: jest.fn() };
  const updated = {
    id: 'u1',
    getRoles: jest.fn().mockResolvedValue([{ alias: 'USER' }]),
  };
  user.reload.mockResolvedValue(updated);
  findUserMock.mockResolvedValueOnce(user);
  verifyCodeMock.mockResolvedValueOnce();
  fetchPassportMock.mockResolvedValueOnce({});
  fetchBankMock.mockResolvedValueOnce({});
  fetchAddressMock.mockResolvedValueOnce({});
  const req = {
    body: { email: 't@example.com', code: '123', password: 'Passw0rd' },
  };
  const res = createRes();
  await controller.finish(req, res);
  expect(verifyCodeMock).toHaveBeenCalledWith(
    user,
    '123',
    'REGISTRATION_STEP_1'
  );
  expect(resetPasswordMock).toHaveBeenCalledWith('u1', 'Passw0rd');
  expect(fetchAddressMock).toHaveBeenCalledWith('u1');
  expect(fetchBankMock).toHaveBeenCalledWith('u1');
  expect(fetchPassportMock).toHaveBeenCalledWith('u1');
  expect(issueTokensMock).toHaveBeenCalledWith(updated);
  expect(setRefreshCookieMock).toHaveBeenCalledWith(res, 'r');
  expect(res.json).toHaveBeenCalledWith({
    access_token: 'a',
    user: { id: 'u1' },
    roles: ['USER'],
  });
});

test('finish returns error when code invalid or expired', async () => {
  const user = { id: 'u1' };
  findUserMock.mockResolvedValueOnce(user);
  verifyCodeMock.mockRejectedValueOnce(new Error('invalid_code'));
  const req = {
    body: { email: 't@example.com', code: 'bad', password: 'Pass' },
  };
  const res = createRes();
  await controller.finish(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'invalid_code' });
});
