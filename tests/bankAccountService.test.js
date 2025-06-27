import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const createMock = jest.fn();
const findByPkMock = jest.fn();
const updateMock = jest.fn();
const findExtMock = jest.fn();
const legacyFindMock = jest.fn();
const findBankMock = jest.fn();

const accountInstance = { update: updateMock };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  BankAccount: {
    findOne: findOneMock,
    create: createMock,
  },
  User: { findByPk: findByPkMock },
  UserExternalId: { findOne: findExtMock },
}));

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findById: legacyFindMock },
}));

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  default: { findBankByBic: findBankMock },
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

test('importFromLegacy returns existing account', async () => {
  findOneMock.mockResolvedValue(accountInstance);
  const res = await service.importFromLegacy('u1');
  expect(res).toBe(accountInstance);
  expect(findExtMock).not.toHaveBeenCalled();
});

test('importFromLegacy creates account from legacy data', async () => {
  findOneMock.mockResolvedValueOnce(null); // existing check
  findExtMock.mockResolvedValue({ external_id: '5' });
  legacyFindMock.mockResolvedValue({
    bank_rs: '40702810900000005555',
    bik_bank: '044525225',
  });
  findByPkMock.mockResolvedValue({ id: 'u1' });
  findOneMock.mockResolvedValueOnce(null); // createForUser existing check
  const created = { id: 'b1' };
  createMock.mockResolvedValue(created);
  findBankMock.mockResolvedValue({
    value: 'Bank',
    data: { correspondent_account: '301', swift: 'SW', inn: '1', kpp: '2', address: { unrestricted_value: 'A' } },
  });

  const res = await service.importFromLegacy('u1');
  expect(createMock).toHaveBeenCalled();
  expect(findBankMock).toHaveBeenCalledWith('044525225');
  expect(res).toBe(created);
});

test('importFromLegacy returns null on invalid data', async () => {
  findOneMock.mockResolvedValueOnce(null);
  findExtMock.mockResolvedValue({ external_id: '9' });
  legacyFindMock.mockResolvedValue({ bank_rs: '1', bik_bank: '2' });
  findBankMock.mockClear();

  const res = await service.importFromLegacy('u2');
  expect(res).toBeNull();
  expect(findBankMock).not.toHaveBeenCalled();
});

test('fetchFromLegacy returns null when user not linked', async () => {
  findExtMock.mockResolvedValue(null);
  legacyFindMock.mockClear();
  const res = await service.fetchFromLegacy('u1');
  expect(res).toBeNull();
  expect(legacyFindMock).not.toHaveBeenCalled();
});

test('fetchFromLegacy returns sanitized data', async () => {
  findExtMock.mockResolvedValue({ external_id: '5' });
  legacyFindMock.mockResolvedValue({
    bank_rs: '40702810900000005555',
    bik_bank: '044525225',
  });
  findBankMock.mockResolvedValue({
    value: 'Bank',
    data: {
      correspondent_account: '301',
      swift: 'SW',
      inn: '1',
      kpp: '2',
      address: { unrestricted_value: 'A' },
    },
  });

  const res = await service.fetchFromLegacy('u1');
  expect(res).toEqual({
    number: '40702810900000005555',
    bic: '044525225',
    bank_name: 'Bank',
    correspondent_account: '301',
    swift: 'SW',
    inn: '1',
    kpp: '2',
    address: 'A',
  });
});


