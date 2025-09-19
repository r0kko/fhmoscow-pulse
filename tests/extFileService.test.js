import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const extFindAllMock = jest.fn();
const localFindAllMock = jest.fn();
const localCreateMock = jest.fn();
const localUpdateMock = jest.fn();
const transactionMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  localFindAllMock.mockReset();
  localCreateMock.mockReset();
  localUpdateMock.mockReset();
  transactionMock.mockReset();
  transactionMock.mockImplementation(async (callback) => callback({}));
});

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  ExtFile: { findAll: extFindAllMock },
}));

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: transactionMock },
}));

jest.unstable_mockModule('../src/models/extFile.js', () => ({
  __esModule: true,
  default: {
    findAll: localFindAllMock,
    create: localCreateMock,
    update: localUpdateMock,
  },
}));

const { syncExtFiles } = await import('../src/services/extFileService.js');

function mockLocalFindAllSequence(...responses) {
  localFindAllMock.mockImplementationOnce(() =>
    Promise.resolve(responses[0] ?? [])
  );
  if (responses.length > 1) {
    localFindAllMock.mockImplementationOnce(() =>
      Promise.resolve(responses[1] ?? [])
    );
  }
}

test('syncExtFiles imports records with object_status="new" like active', async () => {
  extFindAllMock
    .mockResolvedValueOnce([
      {
        id: 1,
        module: 'gallery',
        name: 'fresh-file',
        mime_type: 'image/png',
        size: 123,
        object_status: 'new',
        date_create: '2023-01-01T00:00:00Z',
        date_update: '2023-01-02T00:00:00Z',
      },
    ])
    .mockResolvedValueOnce([]);

  mockLocalFindAllSequence([], [{ external_id: 1, id: 'loc-1' }]);
  localCreateMock.mockResolvedValue({ id: 'loc-1' });
  localUpdateMock.mockResolvedValue([0]);

  const result = await syncExtFiles({ actorId: 'actor-1' });

  expect(localCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: 1,
      object_status: 'new',
      created_by: 'actor-1',
      updated_by: 'actor-1',
    }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );
  expect(result.stats.upserts).toBe(1);
  expect(result.stats.softDeletedByStatus).toBe(0);
  expect(result.idByExternalId.get(1)).toBe('loc-1');
});

test('syncExtFiles soft deletes records with statuses other than active/new during scoped sync', async () => {
  extFindAllMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 2,
        object_status: 'draft',
      },
    ])
    .mockResolvedValueOnce([
      {
        id: 2,
        object_status: 'draft',
      },
    ]);

  mockLocalFindAllSequence([], []);
  localUpdateMock.mockResolvedValueOnce([1]);

  const result = await syncExtFiles({ actorId: 'actor-2', externalIds: [2] });

  expect(localCreateMock).not.toHaveBeenCalled();
  expect(localUpdateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      deletedAt: expect.any(Date),
      updated_by: 'actor-2',
    }),
    expect.objectContaining({
      where: expect.objectContaining({
        external_id: expect.objectContaining({ [Op.in]: [2] }),
      }),
      paranoid: false,
      transaction: expect.any(Object),
    })
  );
  expect(result.stats.softDeletedByStatus).toBe(1);
});
