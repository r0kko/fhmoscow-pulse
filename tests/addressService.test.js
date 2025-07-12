import { beforeEach, expect, jest, test } from '@jest/globals';

const userFindMock = jest.fn();
const addressTypeFindMock = jest.fn();
const userAddressFindMock = jest.fn();
const userAddressCreateMock = jest.fn();
const addressCreateMock = jest.fn();
const addressFindMock = jest.fn();
const cleanAddressMock = jest.fn();
const findExtMock = jest.fn();
const findLegacyMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Address: { create: addressCreateMock, findByPk: addressFindMock },
  AddressType: { findOne: addressTypeFindMock },
  UserAddress: { findOne: userAddressFindMock, create: userAddressCreateMock },
  User: { findByPk: userFindMock },
  UserExternalId: { findOne: findExtMock },
}));

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  default: { cleanAddress: cleanAddressMock },
  cleanAddress: cleanAddressMock,
}));

jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findById: findLegacyMock },
  findById: findLegacyMock,
}));

const servicePath = '../src/services/addressService.js';

beforeEach(() => {
  jest.resetModules();
  userFindMock.mockReset();
  addressTypeFindMock.mockReset();
  userAddressFindMock.mockReset();
  userAddressCreateMock.mockReset();
  addressCreateMock.mockReset();
  addressFindMock.mockReset();
  cleanAddressMock.mockReset();
  findExtMock.mockReset();
  findLegacyMock.mockReset();
});

test('createForUser throws when user missing', async () => {
  userFindMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.createForUser('u1', 'REG', { result: 'x' }, 'a'))
    .rejects.toThrow('user_not_found');
});

test('createForUser throws when type missing', async () => {
  userFindMock.mockResolvedValue({});
  addressTypeFindMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.createForUser('u1', 'REG', { result: 'x' }, 'a'))
    .rejects.toThrow('address_type_not_found');
});

test('createForUser throws when address exists', async () => {
  userFindMock.mockResolvedValue({});
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValue({});
  const service = (await import(servicePath)).default;
  await expect(service.createForUser('u1', 'REG', { result: 'x' }, 'a'))
    .rejects.toThrow('address_exists');
});

test('createForUser throws on invalid address', async () => {
  userFindMock.mockResolvedValue({});
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValue(null);
  cleanAddressMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.createForUser('u1', 'REG', { result: 'x' }, 'a'))
    .rejects.toThrow('invalid_address');
});

test('createForUser returns created address', async () => {
  userFindMock.mockResolvedValue({});
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValue(null);
  cleanAddressMock.mockResolvedValue({ street: 's', result: 'clean' });
  addressCreateMock.mockResolvedValue({ id: 'a1' });
  const service = (await import(servicePath)).default;
  const res = await service.createForUser('u1', 'REG', { result: 'x' }, 'a');
  expect(addressCreateMock).toHaveBeenCalledWith({
    street: 's',
    result: 'clean',
    created_by: 'a',
    updated_by: 'a',
  });
  expect(userAddressCreateMock).toHaveBeenCalledWith({
    user_id: 'u1',
    address_id: 'a1',
    address_type_id: 't',
    created_by: 'a',
    updated_by: 'a',
  });
  expect(res).toEqual({ id: 'a1', AddressType: { id: 't' } });
});

test('fetchFromLegacy returns null when no external id', async () => {
  findExtMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  const res = await service.fetchFromLegacy('u1');
  expect(res).toBeNull();
});

test('fetchFromLegacy returns null when legacy missing', async () => {
  findExtMock.mockResolvedValue({ external_id: 'e1' });
  findLegacyMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  const res = await service.fetchFromLegacy('u1');
  expect(res).toBeNull();
});

test('fetchFromLegacy returns null when no address parts', async () => {
  findExtMock.mockResolvedValue({ external_id: 'e1' });
  findLegacyMock.mockResolvedValue({});
  const service = (await import(servicePath)).default;
  const res = await service.fetchFromLegacy('u1');
  expect(res).toBeNull();
});

test('fetchFromLegacy returns null when cleaning fails', async () => {
  findExtMock.mockResolvedValue({ external_id: 'e1' });
  findLegacyMock.mockResolvedValue({ adr_ind: '1', adr_city: 'C', adr_adr: 'S' });
  cleanAddressMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  const res = await service.fetchFromLegacy('u1');
  expect(res).toBeNull();
});

test('fetchFromLegacy returns cleaned result', async () => {
  findExtMock.mockResolvedValue({ external_id: 'e1' });
  findLegacyMock.mockResolvedValue({ adr_ind: '1', adr_city: 'C', adr_adr: 'S' });
  cleanAddressMock.mockResolvedValue({ result: 'ok' });
  const service = (await import(servicePath)).default;
  const res = await service.fetchFromLegacy('u1');
  expect(cleanAddressMock).toHaveBeenCalled();
  expect(res).toEqual({ result: 'ok' });
});

test('importFromLegacy returns existing address', async () => {
  userAddressFindMock.mockResolvedValueOnce({ id: 'ex' });
  const service = (await import(servicePath)).default;
  const res = await service.importFromLegacy('u1', 'a');
  expect(res).toEqual({ id: 'ex' });
});

test('importFromLegacy returns null when legacy missing', async () => {
  userAddressFindMock.mockResolvedValueOnce(null);
  findExtMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  const res = await service.importFromLegacy('u1', 'a');
  expect(res).toBeNull();
});

test('importFromLegacy returns null when create fails', async () => {
  userAddressFindMock.mockResolvedValueOnce(null); // existing check
  // fetchFromLegacy success path
  findExtMock.mockResolvedValue({ external_id: 'e1' });
  findLegacyMock.mockResolvedValue({ adr_ind: '1', adr_city: 'C', adr_adr: 'S' });
  cleanAddressMock.mockResolvedValue({ result: 'ok' });
  userFindMock.mockResolvedValue({});
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValueOnce(null); // inside createForUser
  addressCreateMock.mockRejectedValue(new Error('fail'));
  const service = (await import(servicePath)).default;
  const res = await service.importFromLegacy('u1', 'a');
  expect(res).toBeNull();
});

test('importFromLegacy creates address from legacy', async () => {
  userAddressFindMock.mockResolvedValueOnce(null); // existing check
  findExtMock.mockResolvedValue({ external_id: 'e1' });
  findLegacyMock.mockResolvedValue({ adr_ind: '1', adr_city: 'C', adr_adr: 'S' });
  cleanAddressMock.mockResolvedValue({ result: 'ok', street: 'S' });
  userFindMock.mockResolvedValue({});
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValueOnce(null); // inside createForUser
  addressCreateMock.mockResolvedValue({ id: 'a1' });
  const service = (await import(servicePath)).default;
  const res = await service.importFromLegacy('u1', 'a');
  expect(res).toEqual({ id: 'a1', AddressType: { id: 't' } });
});

test('getForUser returns null when type missing', async () => {
  addressTypeFindMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.getForUser('u1', 'REG')).rejects.toThrow('address_type_not_found');
});

test('getForUser returns address', async () => {
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValue({ Address: { id: 'a' }, AddressType: { id: 't' } });
  const service = (await import(servicePath)).default;
  const res = await service.getForUser('u1', 'REG');
  expect(res).toEqual({ id: 'a', AddressType: { id: 't' } });
});

test('updateForUser updates address', async () => {
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  const addressUpdate = jest.fn();
  const uaUpdate = jest.fn();
  userAddressFindMock.mockResolvedValue({ address_id: 'a1', Address: { update: addressUpdate }, update: uaUpdate });
  cleanAddressMock.mockResolvedValue({ street: 's', result: 'clean' });
  addressFindMock.mockResolvedValue({ id: 'a1' });
  const service = (await import(servicePath)).default;
  const res = await service.updateForUser('u1', 'REG', { result: 'x' }, 'a');
  expect(addressUpdate).toHaveBeenCalled();
  expect(uaUpdate).toHaveBeenCalled();
  expect(res).toEqual({ id: 'a1', AddressType: { id: 't' } });
});

test('removeForUser deletes address', async () => {
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  const addrUpdate = jest.fn();
  const addrDestroy = jest.fn();
  const uaUpdate = jest.fn();
  const uaDestroy = jest.fn();
  userAddressFindMock.mockResolvedValue({ Address: { update: addrUpdate, destroy: addrDestroy }, update: uaUpdate, destroy: uaDestroy });
  const service = (await import(servicePath)).default;
  await service.removeForUser('u1', 'REG', 'a');
  expect(addrUpdate).toHaveBeenCalledWith({ updated_by: 'a' });
  expect(addrDestroy).toHaveBeenCalled();
  expect(uaUpdate).toHaveBeenCalledWith({ updated_by: 'a' });
  expect(uaDestroy).toHaveBeenCalled();
});

test('getForUser returns null when address not found', async () => {
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  const res = await service.getForUser('u1', 'REG');
  expect(res).toBeNull();
});

test('updateForUser throws when type missing', async () => {
  addressTypeFindMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.updateForUser('u1', 'REG', { result: 'x' }, 'a')).rejects.toThrow('address_type_not_found');
});

test('updateForUser throws when address missing', async () => {
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.updateForUser('u1', 'REG', { result: 'x' }, 'a')).rejects.toThrow('address_not_found');
});

test('updateForUser throws on invalid address', async () => {
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValue({ Address: {}, update: jest.fn() });
  cleanAddressMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.updateForUser('u1', 'REG', { result: 'x' }, 'a')).rejects.toThrow('invalid_address');
});

test('removeForUser throws when type missing', async () => {
  addressTypeFindMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.removeForUser('u1', 'REG', 'a')).rejects.toThrow('address_type_not_found');
});

test('removeForUser throws when address missing', async () => {
  addressTypeFindMock.mockResolvedValue({ id: 't' });
  userAddressFindMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.removeForUser('u1', 'REG', 'a')).rejects.toThrow('address_not_found');
});
