import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const createMock = jest.fn();
const removeMock = jest.fn();
const findBankMock = jest.fn();
const toPublicMock = jest.fn(() => ({ id: 'b1' }));

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: { createForUser: createMock, removeForUser: removeMock },
}));

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  default: { findBankByBic: findBankMock },
}));

jest.unstable_mockModule('../src/mappers/bankAccountMapper.js', () => ({
  __esModule: true,
  default: { toPublic: toPublicMock },
}));

const { default: controller } =
  await import('../src/controllers/bankAccountSelfController.js');

test('create returns 400 on validation errors', async () => {
  validationOk = false;
  const req = { user: { id: '1' }, body: {} };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ errors: [{ msg: 'bad' }] });
  validationOk = true;
});

test('create stores new bank account', async () => {
  findBankMock.mockResolvedValue({
    value: 'Bank',
    data: {
      correspondent_account: '301',
      swift: 'SW',
      inn: '1',
      kpp: '2',
      address: 'A',
    },
  });
  createMock.mockResolvedValue({ id: 'b1' });
  const req = {
    user: { id: '1' },
    body: { number: '40702810900000005555', bic: '044525225' },
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(findBankMock).toHaveBeenCalledWith('044525225');
  expect(createMock).toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(201);
  expect(toPublicMock).toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ account: { id: 'b1' } });
});
