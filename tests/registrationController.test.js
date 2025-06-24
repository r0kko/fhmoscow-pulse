import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const findOneMock = jest.fn();
const findExternalSystemMock = jest.fn();
const createExternalMock = jest.fn();
  ExternalSystem: { findOne: findExternalSystemMock },
  UserExternalId: { create: createExternalMock },
const createUserMock = jest.fn();
const findLegacyMock = jest.fn();
const sendCodeMock = jest.fn();
const createInnMock = jest.fn();
const createSnilsMock = jest.fn();
const createPassportMock = jest.fn();
const createBankMock = jest.fn();
const findBankMock = jest.fn();

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  default: { findByEmail: findLegacyMock },
}));

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { resetPassword: resetPasswordMock, createUser: createUserMock },
  default: { verifyCode: verifyCodeMock, sendCode: sendCodeMock },
jest.unstable_mockModule('../src/services/innService.js', () => ({
  __esModule: true,
  default: { create: createInnMock },
}));

jest.unstable_mockModule('../src/services/snilsService.js', () => ({
  __esModule: true,
  default: { create: createSnilsMock },
}));

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: { createForUser: createPassportMock },
}));

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  default: { createForUser: createBankMock },
}));

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  default: { findBankByBic: findBankMock },

jest.unstable_mockModule('../src/utils/cookie.js', () => ({
  __esModule: true,
  setRefreshCookie: setRefreshCookieMock,
}));



test('start imports legacy data', async () => {
  findOneMock.mockResolvedValue(null);
  findExternalSystemMock.mockResolvedValue({ id: 'ext' });
  createExternalMock.mockResolvedValue({});
  findLegacyMock.mockResolvedValue({
    id: 10,
    last_name: 'L',
    first_name: 'F',
    second_name: 'S',
    b_date: '2000-01-01',
    phone_cod: '123',
    phone_number: '4567890',
    sv_inn: '123456789012',
    sv_ops: '123-456-789 00',
    ps_ser: '1111',
    ps_num: 222222,
    ps_date: '2015-01-01',
    ps_org: 'OVD',
    ps_pdrz: '770-001',
    bank_rs: '40702810900000005555',
    bik_bank: '044525225',
  });
  findBankMock.mockResolvedValue({
    value: 'Bank',
    data: { correspondent_account: '301', swift: 'SW', inn: '1', kpp: '2', address: 'A' },
  });
  createUserMock.mockResolvedValue({ id: '1' });
  const req = { body: { email: 'e@x.ru' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

  await controller.start(req, res);

  expect(createUserMock).toHaveBeenCalled();
  expect(createSnilsMock).toHaveBeenCalledWith('1', '123-456-789 00', '1');
  expect(createInnMock).toHaveBeenCalledWith('1', '123456789012', '1');
  expect(createPassportMock).toHaveBeenCalled();
  expect(createBankMock).toHaveBeenCalled();
  expect(sendCodeMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ message: 'code_sent' });
});
jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findOne: findOneMock },
  ExternalSystem: { findOne: findExternalSystemMock },
  UserExternalId: { create: createExternalMock },
}));

const createUserMock = jest.fn();
const findLegacyMock = jest.fn();
const sendCodeMock = jest.fn();
const createInnMock = jest.fn();
const createSnilsMock = jest.fn();
const createPassportMock = jest.fn();
const createBankMock = jest.fn();
const findBankMock = jest.fn();

jest.unstable_mockModule('../src/services/authService.js', () => ({
  __esModule: true,
  default: { issueTokens: issueTokensMock },
}));

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findByEmail: findLegacyMock },
}));

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { resetPassword: resetPasswordMock, createUser: createUserMock },
}));

jest.unstable_mockModule('../src/services/emailVerificationService.js', () => ({
  __esModule: true,
  default: { verifyCode: verifyCodeMock, sendCode: sendCodeMock },
}));

jest.unstable_mockModule('../src/services/innService.js', () => ({
  __esModule: true,
  default: { create: createInnMock },
}));

jest.unstable_mockModule('../src/services/snilsService.js', () => ({
  __esModule: true,
  default: { create: createSnilsMock },
}));

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: { createForUser: createPassportMock },
}));

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: { createForUser: createBankMock },
}));

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  default: { findBankByBic: findBankMock },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

jest.unstable_mockModule('../src/utils/cookie.js', () => ({
  __esModule: true,
  setRefreshCookie: setRefreshCookieMock,
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

test('start imports legacy data', async () => {
  findOneMock.mockResolvedValue(null);
  findExternalSystemMock.mockResolvedValue({ id: 'ext' });
  createExternalMock.mockResolvedValue({});
  findLegacyMock.mockResolvedValue({
    id: 10,
    last_name: 'L',
    first_name: 'F',
    second_name: 'S',
    b_date: '2000-01-01',
    phone_cod: '123',
    phone_number: '4567890',
    sv_inn: '123456789012',
    sv_ops: '123-456-789 00',
    ps_ser: '1111',
    ps_num: 222222,
    ps_date: '2015-01-01',
    ps_org: 'OVD',
    ps_pdrz: '770-001',
    bank_rs: '40702810900000005555',
    bik_bank: '044525225',
  });
  findBankMock.mockResolvedValue({
    value: 'Bank',
    data: { correspondent_account: '301', swift: 'SW', inn: '1', kpp: '2', address: 'A' },
  });
  createUserMock.mockResolvedValue({ id: '1' });
  const req = { body: { email: 'e@x.ru' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

  await controller.start(req, res);

  expect(createUserMock).toHaveBeenCalled();
  expect(createSnilsMock).toHaveBeenCalledWith('1', '123-456-789 00', '1');
  expect(createInnMock).toHaveBeenCalledWith('1', '123456789012', '1');
  expect(createPassportMock).toHaveBeenCalled();
  expect(createBankMock).toHaveBeenCalled();
  expect(sendCodeMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ message: 'code_sent' });
});
