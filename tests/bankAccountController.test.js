import { expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: { getByUser: jest.fn() },
}));

jest.unstable_mockModule('../src/mappers/bankAccountMapper.js', () => ({
  __esModule: true,
  default: { toPublic: jest.fn((a) => a) },
}));

const findOneExtMock = jest.fn();
const legacyFindMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  UserExternalId: { findOne: findOneExtMock },
}));

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findById: legacyFindMock },
}));

const { default: controller } = await import('../src/controllers/bankAccountController.js');
const service = await import('../src/services/bankAccountService.js');

test('me returns stored account', async () => {
  service.default.getByUser.mockResolvedValue({ id: 'b1' });
  const req = { user: { id: 'u1' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(res.json).toHaveBeenCalled();
});

test('me returns legacy account when not stored', async () => {
  service.default.getByUser.mockResolvedValue(null);
  findOneExtMock.mockResolvedValue({ external_id: '8' });
  legacyFindMock.mockResolvedValue({ bank_rs: '40702810', bik_bank: '044525225' });
  const req = { user: { id: 'u1' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(res.json).toHaveBeenCalledWith({
    account: { number: '40702810', bic: '044525225' },
  });
});

