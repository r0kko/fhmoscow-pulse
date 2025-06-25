import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const createMock = jest.fn();
const findByPkMock = jest.fn();
const updateMock = jest.fn();

const accountInstance = { update: updateMock };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  BankAccount: {
    findOne: findOneMock,
    create: createMock,
  },
  User: { findByPk: findByPkMock },
}));

const { default: service } = await import('../src/services/bankAccountService.js');

findOneMock.mockResolvedValue(accountInstance);


test('updateForUser throws when account missing', async () => {
  findOneMock.mockResolvedValueOnce(null);
  await expect(service.updateForUser('u', {}, 'a')).rejects.toThrow('bank_account_not_found');
});

test('updateForUser rejects number or bic changes', async () => {
  findOneMock.mockResolvedValueOnce({ ...accountInstance, number: '1', bic: '2' });
  await expect(service.updateForUser('u', { number: 'x' }, 'a')).rejects.toThrow('bank_account_locked');
  await expect(service.updateForUser('u', { bic: 'y' }, 'a')).rejects.toThrow('bank_account_locked');
});

test('updateForUser updates other fields', async () => {
  const acc = { ...accountInstance, number: '1', bic: '2' };
  findOneMock.mockResolvedValueOnce(acc);
  updateMock.mockResolvedValue();
  const data = { bank_name: 'bank' };
  const res = await service.updateForUser('u', data, 'admin');
  expect(updateMock).toHaveBeenCalledWith({ ...data, updated_by: 'admin' });
  expect(res).toBe(acc);
});


