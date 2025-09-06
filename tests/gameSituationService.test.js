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
  GameSituation: { findAll: extFindAllMock },
}));

const txMock = {};
const transactionMock = jest.fn(async (cb) => cb(txMock));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  GameSituation: {
    findAll: localFindAllMock,
    create: localCreateMock,
    update: localUpdateMock,
    sequelize: { transaction: transactionMock },
  },
}));

const { default: gameSituationService } = await import(
  '../src/services/gameSituationService.js'
);

test('syncExternal upserts and soft deletes by external_id', async () => {
  extFindAllMock.mockResolvedValueOnce([
    { id: 1, name: 'EVEN' },
    { id: 2, name: 'PP' },
  ]);
  localCreateMock.mockResolvedValueOnce({ id: 's1' });

  await gameSituationService.syncExternal('admin');

  expect(localCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({ external_id: 1, name: 'EVEN' }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );

  const calls = localUpdateMock.mock.calls;
  const missingCall = calls.find((c) => c?.[1]?.where?.external_id?.[Op.notIn]);
  expect(missingCall).toBeTruthy();
  expect(missingCall[1].where.external_id[Op.notIn]).toEqual([1, 2]);
  expect(missingCall[1].where.external_id[Op.ne]).toBeNull();
});
