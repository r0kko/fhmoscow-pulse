import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const extFindAllMock = jest.fn();
const extCountMock = jest.fn();
const clubCreateMock = jest.fn();
const clubUpdateMock = jest.fn();
const clubFindAllMock = jest.fn();
const clubCountMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  extCountMock.mockReset().mockResolvedValue(0);
  clubCreateMock.mockReset();
  clubUpdateMock.mockReset();
  clubFindAllMock.mockReset();
  clubCountMock.mockReset().mockResolvedValue(0);
  clubUpdateMock.mockResolvedValue([0]);
  clubFindAllMock.mockResolvedValue([]);
});

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Club: { findAll: extFindAllMock, count: extCountMock },
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
    count: clubCountMock,
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
      is_moscow: false,
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

test('syncExternal forces full sync when Moscow flag backfill is needed', async () => {
  const since = new Date('2024-01-01T00:00:00Z');
  extCountMock.mockResolvedValue(2);
  extFindAllMock
    .mockResolvedValueOnce([{ id: 44, short_name: 'HC Dynamo', is_moscow: 1 }])
    .mockResolvedValueOnce([]);
  clubFindAllMock.mockResolvedValue([]);

  await service.syncExternal({ actorId: 'admin', mode: 'incremental', since });

  expect(clubCountMock).toHaveBeenCalledWith({ where: { is_moscow: true } });
  expect(extCountMock).toHaveBeenCalled();
  expect(extFindAllMock).toHaveBeenCalledTimes(2);
  expect(clubCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: 44,
      is_moscow: true,
    }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );
});
