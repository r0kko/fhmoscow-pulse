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
  PenaltyMinutes: { findAll: extFindAllMock },
}));

const txMock = {};
const transactionMock = jest.fn(async (cb) => cb(txMock));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  PenaltyMinutes: {
    findAll: localFindAllMock,
    create: localCreateMock,
    update: localUpdateMock,
    sequelize: { transaction: transactionMock },
  },
}));

const { default: penaltyMinutesService } =
  await import('../src/services/penaltyMinutesService.js');

test('syncExternal upserts and soft deletes by external_id', async () => {
  extFindAllMock.mockResolvedValueOnce([
    { id: 2, name: '2 min' },
    { id: 5, name: '5 min' },
  ]);
  localCreateMock.mockResolvedValueOnce({ id: 'p1' });

  await penaltyMinutesService.syncExternal('admin');

  expect(localCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({ external_id: 2, name: '2 min' }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );

  const calls = localUpdateMock.mock.calls;
  const missingCall = calls.find((c) => c?.[1]?.where?.external_id?.[Op.notIn]);
  expect(missingCall).toBeTruthy();
  expect(missingCall[1].where.external_id[Op.notIn]).toEqual([2, 5]);
  expect(missingCall[1].where.external_id[Op.ne]).toBeNull();
});
