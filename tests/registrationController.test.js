import { beforeEach, expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const findOneUserMock = jest.fn();
const findLegacyMock = jest.fn();
const createUserMock = jest.fn();
const findSystemMock = jest.fn();
const createExtMock = jest.fn();
const sendCodeMock = jest.fn();

const transaction = { commit: jest.fn(), rollback: jest.fn() };
const transactionFn = jest.fn(() => transaction);

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: transactionFn },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findOne: findOneUserMock },
  ExternalSystem: { findOne: findSystemMock },
  UserExternalId: { create: createExtMock },
}));

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findByEmail: findLegacyMock },
}));

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { createUser: createUserMock },
}));

jest.unstable_mockModule('../src/services/emailVerificationService.js', () => ({
  __esModule: true,
  default: { sendCode: sendCodeMock },
}));

jest.unstable_mockModule('../src/services/authService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/utils/cookie.js', () => ({
  __esModule: true,
  setRefreshCookie: jest.fn(),
}));

const { default: controller } = await import('../src/controllers/registrationController.js');

beforeEach(() => {
  jest.clearAllMocks();
  validationOk = true;
});

test('start commits on success', async () => {
  findOneUserMock.mockResolvedValueOnce(null); // existing user
  findLegacyMock.mockResolvedValue({
    last_name: 'L',
    first_name: 'F',
    second_name: 'S',
    b_date: '2000-01-01',
    phone_cod: '99',
    phone_number: '1234567',
    id: 'ext1',
  });
  createUserMock.mockResolvedValue({ id: 'u1' });
  findSystemMock.mockResolvedValue({ id: 'sys1' });
  createExtMock.mockResolvedValue({});
  sendCodeMock.mockResolvedValue();

  const req = { body: { email: 'e@x.ru' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await controller.start(req, res);

  expect(transactionFn).toHaveBeenCalled();
  expect(createUserMock).toHaveBeenCalledWith(expect.any(Object), { transaction });
  expect(createExtMock).toHaveBeenCalledWith(expect.any(Object), { transaction });
  expect(sendCodeMock).toHaveBeenCalledWith({ id: 'u1' }, transaction);
  expect(transaction.commit).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ message: 'code_sent' });
});

test('start rolls back on email failure', async () => {
  findOneUserMock.mockResolvedValueOnce(null);
  findLegacyMock.mockResolvedValue({
    last_name: 'L',
    first_name: 'F',
    second_name: 'S',
    b_date: '2000-01-01',
    phone_cod: '99',
    phone_number: '1234567',
    id: 'ext1',
  });
  createUserMock.mockResolvedValue({ id: 'u1' });
  findSystemMock.mockResolvedValue({ id: 'sys1' });
  createExtMock.mockResolvedValue({});
  sendCodeMock.mockRejectedValue(new Error('fail'));

  const req = { body: { email: 'e@x.ru' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await controller.start(req, res);

  expect(transaction.rollback).toHaveBeenCalled();
  expect(transaction.commit).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'fail' });
});

test('start rolls back on external id failure', async () => {
  findOneUserMock.mockResolvedValueOnce(null);
  findLegacyMock.mockResolvedValue({
    last_name: 'L',
    first_name: 'F',
    second_name: 'S',
    b_date: '2000-01-01',
    phone_cod: '99',
    phone_number: '1234567',
    id: 'ext1',
  });
  createUserMock.mockResolvedValue({ id: 'u1' });
  findSystemMock.mockResolvedValue({ id: 'sys1' });
  createExtMock.mockRejectedValue(new Error('bad'));

  const req = { body: { email: 'e@x.ru' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  await controller.start(req, res);

  expect(transaction.rollback).toHaveBeenCalled();
  expect(transaction.commit).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'bad' });
});

