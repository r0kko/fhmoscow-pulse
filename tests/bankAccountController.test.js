import { expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: { getByUser: jest.fn(), fetchFromLegacy: jest.fn() },
}));

jest.unstable_mockModule('../src/mappers/bankAccountMapper.js', () => ({
  __esModule: true,
  default: { toPublic: jest.fn((a) => a) },
}));

const { default: controller } =
  await import('../src/controllers/bankAccountController.js');
const service = await import('../src/services/bankAccountService.js');

test('me returns stored account', async () => {
  service.default.getByUser.mockResolvedValue({ id: 'b1' });
  const req = { user: { id: 'u1' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(res.json).toHaveBeenCalled();
  expect(service.default.fetchFromLegacy).not.toHaveBeenCalled();
});

test('me returns legacy account when none stored', async () => {
  service.default.getByUser.mockResolvedValue(null);
  service.default.fetchFromLegacy.mockResolvedValue({
    number: '40702810',
    bic: '044525225',
  });
  const req = { user: { id: 'u1' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await controller.me(req, res);
  expect(res.json).toHaveBeenCalledWith({
    account: { number: '40702810', bic: '044525225' },
  });
});
