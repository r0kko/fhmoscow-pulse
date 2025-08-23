import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const extFindAllMock = jest.fn();
const clubCreateMock = jest.fn();
const clubUpdateMock = jest.fn();
const clubFindAllMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  clubCreateMock.mockReset();
  clubUpdateMock.mockReset();
  clubFindAllMock.mockReset();
  clubUpdateMock.mockResolvedValue([0]);
  clubFindAllMock.mockResolvedValue([]);
});

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Club: { findAll: extFindAllMock },
}));

// Mock sequelize transaction to avoid real DB calls
const txMock = {};
const transactionMock = jest.fn(async (cb) => cb(txMock));
jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: transactionMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Club: {
    create: clubCreateMock,
    update: clubUpdateMock,
    findAll: clubFindAllMock,
  },
}));

const { default: service } = await import('../src/services/clubService.js');

test('syncExternal upserts active clubs and soft deletes missing ones', async () => {
  extFindAllMock.mockResolvedValue([{ id: 11, short_name: 'HC Spartak' }]);
  await service.syncExternal('admin');
  // External fetch is invoked (active + archive); we don't assert exact where shape
  expect(extFindAllMock).toHaveBeenCalled();
  expect(clubCreateMock).toHaveBeenCalledWith(
    {
      external_id: 11,
      name: 'HC Spartak',
      created_by: 'admin',
      updated_by: 'admin',
    },
    expect.objectContaining({ transaction: expect.any(Object) })
  );
  const calls = clubUpdateMock.mock.calls;
  // Find the call that handles soft-deleting missing (NOT IN active)
  const missingCall = calls.find((c) => c?.[1]?.where?.external_id?.[Op.notIn]);
  expect(missingCall).toBeTruthy();
  const whereArg = missingCall[1].where;
  expect(whereArg.external_id[Op.notIn]).toEqual([11]);
  expect(whereArg.external_id[Op.ne]).toBeNull();
  expect(missingCall[0]).toMatchObject({ updated_by: 'admin' });
});
