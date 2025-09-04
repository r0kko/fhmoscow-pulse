import { beforeEach, expect, jest, test } from '@jest/globals';

const cleanAddressMock = jest.fn();

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  cleanAddress: cleanAddressMock,
}));

// Prevent loading the full externalModels graph which skews coverage
jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Stadium: { findAll: jest.fn() },
}));

const findByPkMock = jest.fn();
const addressCreateMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Ground: { findByPk: findByPkMock },
  Address: { create: addressCreateMock },
}));

const { default: service } = await import('../src/services/groundService.js');

beforeEach(() => {
  cleanAddressMock.mockReset();
  findByPkMock.mockReset();
  addressCreateMock.mockReset();
});

test('update clears address when empty string is provided', async () => {
  const addrUpdate = jest.fn();
  const addrDestroy = jest.fn();
  const groundUpdate = jest.fn();
  const ground = {
    id: 'g1',
    name: 'G',
    yandex_url: null,
    Address: { update: addrUpdate, destroy: addrDestroy, id: 'a1' },
    update: groundUpdate,
  };
  // first call (for update) and second call (for getById) return ground
  findByPkMock.mockResolvedValue(ground);
  await service.update('g1', { address: { result: '' } }, 'admin');
  expect(addrUpdate).toHaveBeenCalledWith({ updated_by: 'admin' });
  // first ground.update clears address_id
  const firstCallArgs = groundUpdate.mock.calls[0][0];
  expect(firstCallArgs).toMatchObject({
    address_id: null,
    updated_by: 'admin',
  });
  expect(addrDestroy).toHaveBeenCalled();
});

test('update creates address if missing and provided', async () => {
  const groundUpdate = jest.fn();
  const groundNoAddr = {
    id: 'g2',
    name: 'G2',
    Address: null,
    update: groundUpdate,
  };
  // first call returns ground without Address, second call (getById) returns same
  findByPkMock.mockResolvedValue(groundNoAddr);
  cleanAddressMock.mockResolvedValue({ result: 'Addr' });
  addressCreateMock.mockResolvedValue({ id: 'newaddr' });
  await service.update('g2', { address: { result: 'Addr' } }, 'admin');
  expect(addressCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({ result: 'Addr', created_by: 'admin' })
  );
  expect(groundUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ address_id: 'newaddr' }),
    expect.any(Object)
  );
});
