import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const extFindAllMock = jest.fn();
const groundFindAllMock = jest.fn();
const groundCreateMock = jest.fn();
const groundUpdateMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  groundFindAllMock.mockReset();
  groundCreateMock.mockReset();
  groundUpdateMock.mockReset();
  groundUpdateMock.mockResolvedValue([0]);
  groundFindAllMock.mockResolvedValue([]);
});

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Stadium: { findAll: extFindAllMock },
}));

// Mock sequelize transaction to avoid real DB calls
const txMock = {};
const transactionMock = jest.fn(async (cb) => cb(txMock));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Ground: {
    findAll: groundFindAllMock,
    create: groundCreateMock,
    update: groundUpdateMock,
    sequelize: { transaction: transactionMock },
  },
  Address: {},
}));

const { default: groundService } = await import(
  '../src/services/groundService.js'
);

test('syncExternal upserts active stadiums and soft deletes archived/missing', async () => {
  // first call -> active, second -> archive
  extFindAllMock
    .mockResolvedValueOnce([{ id: 100, name: 'Main Arena' }])
    .mockResolvedValueOnce([{ id: 200, name: 'Old Arena' }]);
  groundCreateMock.mockResolvedValueOnce({ id: 'g1' });
  await groundService.syncExternal('admin');
  expect(groundCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({ external_id: 100, name: 'Main Arena' }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );

  // Find missing update (NOT IN active)
  const calls = groundUpdateMock.mock.calls;
  const missingCall = calls.find((c) => c?.[1]?.where?.external_id?.[Op.notIn]);
  expect(missingCall).toBeTruthy();
  expect(missingCall[1].where.external_id[Op.notIn]).toEqual([100, 200]);
  expect(missingCall[1].where.external_id[Op.ne]).toBeNull();

  // And archived call (IN archived)
  const archivedCall = calls.find((c) => c?.[1]?.where?.external_id?.[Op.in]);
  expect(archivedCall).toBeTruthy();
  expect(archivedCall[1].where.external_id[Op.in]).toEqual([200]);
});

test('syncExternal incremental uses update_date/create_date for filters and cursor', async () => {
  const since = new Date('2024-01-01T00:00:00Z');
  extFindAllMock
    .mockResolvedValueOnce([
      {
        id: 10,
        name: 'Warmup Arena',
        update_date: new Date('2024-02-01T12:00:00Z'),
      },
    ])
    .mockResolvedValueOnce([
      {
        id: 11,
        name: 'Retired Arena',
        create_date: new Date('2024-01-15T08:00:00Z'),
      },
    ]);
  const result = await groundService.syncExternal({ mode: 'incremental', since });
  const [activeCall, archiveCall] = extFindAllMock.mock.calls;
  expect(activeCall[0].attributes).toEqual(
    expect.arrayContaining(['update_date', 'create_date'])
  );
  expect(activeCall[0].where[Op.and]).toHaveLength(2);
  expect(archiveCall[0].where[Op.and]).toHaveLength(2);
  expect(result.cursor?.toISOString()).toBe('2024-02-01T12:00:00.000Z');
});
