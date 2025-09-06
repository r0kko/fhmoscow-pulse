import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const gpFindAll = jest.fn();
const gpUpdate = jest.fn();
const extFindAll = jest.fn();

beforeEach(() => {
  gpFindAll.mockReset();
  gpUpdate.mockReset();
  extFindAll.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  GamePenalty: {
    findAll: gpFindAll,
    update: gpUpdate,
  },
}));

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  GameEvent: { findAll: extFindAll },
}));

const { reapOrphans } = await import(
  '../src/services/gameEventDeletionSyncService.js'
);

test('reapOrphans soft-deletes local penalties missing in external DB', async () => {
  // First batch returns two rows
  gpFindAll.mockResolvedValueOnce([
    { id: 'a', external_id: 100, createdAt: new Date('2024-01-01T00:00:00Z') },
    { id: 'b', external_id: 200, createdAt: new Date('2024-01-01T00:00:01Z') },
  ]);
  // External has only id=100
  extFindAll.mockResolvedValueOnce([{ id: 100 }]);
  // Second batch is empty (stop)
  gpFindAll.mockResolvedValueOnce([]);
  gpUpdate.mockResolvedValueOnce([1]);

  const res = await reapOrphans({
    batchSize: 2,
    maxBatches: 2,
    actorId: 'admin',
  });
  expect(res.deleted).toBe(1);
  expect(gpUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      deletedAt: expect.any(Date),
      updated_by: 'admin',
    }),
    expect.objectContaining({
      paranoid: false,
      where: expect.objectContaining({
        external_id: expect.objectContaining({ [Op.in]: [200] }),
        deletedAt: null,
      }),
    })
  );
});
