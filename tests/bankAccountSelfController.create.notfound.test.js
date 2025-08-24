import { expect, jest, test } from '@jest/globals';

let validationOk = true;

jest.unstable_mockModule('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => validationOk,
    array: () => [{ msg: 'bad' }],
  })),
}));

const findBankMock = jest.fn();

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  default: { findBankByBic: findBankMock },
}));

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: { createForUser: jest.fn() },
}));

jest.unstable_mockModule('../src/mappers/bankAccountMapper.js', () => ({
  __esModule: true,
  default: { toPublic: jest.fn() },
}));

const { default: controller } = await import('../src/controllers/bankAccountSelfController.js');

test('create returns 400 when bank not found', async () => {
  findBankMock.mockResolvedValue(null);
  const req = { user: { id: 'u1' }, body: { number: 'n', bic: 'b' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.create(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'bank_not_found' });
});

