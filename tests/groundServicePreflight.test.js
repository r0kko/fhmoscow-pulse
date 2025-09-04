import { expect, jest, test } from '@jest/globals';

const stadiumFindAllMock = jest.fn();

// Mock external models (should not be called due to preflight early return)
jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Stadium: { findAll: stadiumFindAllMock },
}));

// Mock models with queryInterface.describeTable returning missing external_id
const describeTableMock = jest.fn(async () => ({}));
const getQueryInterfaceMock = jest.fn(() => ({
  describeTable: describeTableMock,
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Ground: { sequelize: { getQueryInterface: getQueryInterfaceMock } },
  Address: {},
}));

const { default: groundService } = await import(
  '../src/services/groundService.js'
);

test('ground sync preflight returns early when external_id column is missing', async () => {
  const res = await groundService.syncExternal('admin');
  expect(res).toEqual({
    upserts: 0,
    softDeletedTotal: 0,
    softDeletedArchived: 0,
    softDeletedMissing: 0,
  });
  expect(stadiumFindAllMock).not.toHaveBeenCalled();
});
