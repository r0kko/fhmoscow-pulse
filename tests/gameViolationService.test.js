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
  GameViolation: { findAll: extFindAllMock },
}));

const txMock = {};
const transactionMock = jest.fn(async (cb) => cb(txMock));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  GameViolation: {
    findAll: localFindAllMock,
    create: localCreateMock,
    update: localUpdateMock,
    sequelize: { transaction: transactionMock },
  },
}));

const { default: gameViolationService } = await import(
  '../src/services/gameViolationService.js'
);

test('syncExternal upserts name/full_name and soft deletes by external_id', async () => {
  extFindAllMock.mockResolvedValueOnce([
    { id: 10, name: 'HOOKING', full_name: 'Hooking' },
    { id: 20, name: 'BOARD', full_name: 'Boarding' },
  ]);
  localCreateMock.mockResolvedValueOnce({ id: 'v1' });

  await gameViolationService.syncExternal('admin');

  expect(localCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: 10,
      name: 'HOOKING',
      full_name: 'Hooking',
    }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );

  const calls = localUpdateMock.mock.calls;
  const missingCall = calls.find((c) => c?.[1]?.where?.external_id?.[Op.notIn]);
  expect(missingCall).toBeTruthy();
  expect(missingCall[1].where.external_id[Op.notIn]).toEqual([10, 20]);
  expect(missingCall[1].where.external_id[Op.ne]).toBeNull();
});
