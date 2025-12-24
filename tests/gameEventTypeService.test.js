import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const extFindAllMock = jest.fn();
const localFindAllMock = jest.fn();
const localCreateMock = jest.fn();
const localUpdateMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  localFindAllMock.mockReset();
  localCreateMock.mockReset();
  localUpdateMock.mockReset();
  localUpdateMock.mockResolvedValue([0]);
  localFindAllMock.mockResolvedValue([]);
});

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  GameEventType: { findAll: extFindAllMock },
}));

// Mock sequelize transaction to avoid real DB calls
const txMock = {};
const transactionMock = jest.fn(async (cb) => cb(txMock));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  GameEventType: {
    findAll: localFindAllMock,
    create: localCreateMock,
    update: localUpdateMock,
    sequelize: { transaction: transactionMock },
  },
}));

const { default: gameEventTypeService } =
  await import('../src/services/gameEventTypeService.js');

test('syncExternal upserts and soft deletes by external_id', async () => {
  extFindAllMock.mockResolvedValueOnce([
    { id: 1, name: 'Goal' },
    { id: 2, name: 'Penalty' },
  ]);
  localCreateMock.mockResolvedValueOnce({ id: 'evt1' });

  await gameEventTypeService.syncExternal('admin');

  expect(localCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({ external_id: 1, name: 'Goal' }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );

  const calls = localUpdateMock.mock.calls;
  const missingCall = calls.find((c) => c?.[1]?.where?.external_id?.[Op.notIn]);
  expect(missingCall).toBeTruthy();
  expect(missingCall[1].where.external_id[Op.notIn]).toEqual([1, 2]);
  expect(missingCall[1].where.external_id[Op.ne]).toBeNull();
});
