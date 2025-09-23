import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const fileUploadMock = jest.fn();
const fileRemoveMock = jest.fn();

jest.unstable_mockModule('../src/services/fileService.js', () => ({
  __esModule: true,
  default: {
    uploadPlayerPhoto: fileUploadMock,
    removeFile: fileRemoveMock,
  },
}));

const playerFindByPkMock = jest.fn();
const clubPlayerCountMock = jest.fn();
const teamPlayerCountMock = jest.fn();
const photoRequestFindOneMock = jest.fn();
const photoRequestCreateMock = jest.fn();
const photoRequestFindByPkMock = jest.fn();
const photoRequestFindAndCountMock = jest.fn();
const photoRequestFindAllMock = jest.fn();
const statusFindOneMock = jest.fn();

const modelsMock = {
  Player: { findByPk: playerFindByPkMock },
  ClubPlayer: { count: clubPlayerCountMock },
  TeamPlayer: { count: teamPlayerCountMock },
  PlayerPhotoRequest: {
    findOne: photoRequestFindOneMock,
    create: photoRequestCreateMock,
    findByPk: photoRequestFindByPkMock,
    findAndCountAll: photoRequestFindAndCountMock,
    findAll: photoRequestFindAllMock,
  },
  PlayerPhotoRequestStatus: { findOne: statusFindOneMock },
  Club: {},
  Team: {},
  ExtFile: {},
  File: {},
  User: {},
};

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  ...modelsMock,
}));

const txRef = { LOCK: { UPDATE: Symbol('update') } };
const transactionMock = jest.fn(async (cb) => cb(txRef));

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: transactionMock },
}));

const { default: service } = await import(
  '../src/services/playerPhotoRequestService.js'
);

function buildFile() {
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('binary'),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  playerFindByPkMock.mockResolvedValue({ id: 'player-1' });
  clubPlayerCountMock.mockResolvedValue(0);
  teamPlayerCountMock.mockResolvedValue(0);
  photoRequestFindOneMock.mockResolvedValue(null);
  photoRequestCreateMock.mockResolvedValue({ id: 'req-1' });
  photoRequestFindByPkMock.mockResolvedValue({ id: 'req-1' });
  statusFindOneMock.mockImplementation(async ({ where }) => ({
    id: `${where.alias}-id`,
    alias: where.alias,
  }));
  fileUploadMock.mockResolvedValue({ id: 'file-1' });
  fileRemoveMock.mockResolvedValue();
  photoRequestFindAndCountMock.mockResolvedValue({ count: 0, rows: [] });
  photoRequestFindAllMock.mockResolvedValue([]);
});

describe('playerPhotoRequestService.submit', () => {
  test('creates request for admin scope', async () => {
    const payload = {
      actorId: 'admin-1',
      playerId: 'player-1',
      file: buildFile(),
      scope: { isAdmin: true },
    };

    const result = await service.submit(payload);

    expect(fileUploadMock).toHaveBeenCalledWith(
      'player-1',
      expect.any(Object),
      'admin-1'
    );
    expect(photoRequestCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        player_id: 'player-1',
        file_id: 'file-1',
      }),
      expect.objectContaining({ transaction: txRef })
    );
    expect(result).toEqual({ id: 'req-1' });
  });

  describe('playerPhotoRequestService.list', () => {
    test('paginates, hydrates, and applies search', async () => {
      photoRequestFindAndCountMock.mockResolvedValue({
        count: 2,
        rows: [{ id: 'req-2' }, { id: 'req-1' }],
      });
      photoRequestFindAllMock.mockResolvedValue([
        { id: 'req-1', marker: 'first' },
        { id: 'req-2', marker: 'second' },
      ]);

      const result = await service.list({ search: 'Иван Петров' });

      expect(photoRequestFindAndCountMock).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: ['id'],
          order: [['created_at', 'DESC']],
        })
      );
      const where = photoRequestFindAndCountMock.mock.calls[0][0].where;
      expect(where).toBeDefined();
      const literalFilters =
        where?.[Op.and]?.filter((entry) => entry && entry.val) ||
        (where && where.val ? [where] : []);
      const searchClause = literalFilters.find((entry) =>
        entry.val.includes('FROM players p')
      );
      expect(searchClause).toBeDefined();
      expect(searchClause.val).toContain('LOWER(COALESCE(p.surname');
      expect(searchClause.val.toLowerCase()).toContain('%иван%');

      expect(photoRequestFindAllMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { [Op.in]: ['req-2', 'req-1'] } },
        })
      );

      expect(result.count).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);
      expect(result.rows.map((row) => row.id)).toEqual(['req-2', 'req-1']);
    });

    test('supports status filter and empty dataset', async () => {
      statusFindOneMock.mockResolvedValueOnce({
        id: 'status-pending',
        alias: 'pending',
      });
      photoRequestFindAndCountMock.mockResolvedValue({ count: 0, rows: [] });

      const result = await service.list({
        status: 'pending',
        page: 2,
        limit: 10,
      });

      expect(photoRequestFindAndCountMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status_id: 'status-pending' },
          limit: 10,
          offset: 10,
        })
      );
      expect(photoRequestFindAllMock).not.toHaveBeenCalled();
      expect(result.rows).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });

  test('throws when player not found', async () => {
    playerFindByPkMock.mockResolvedValue(null);
    await expect(
      service.submit({
        actorId: 'user',
        playerId: 'missing',
        file: buildFile(),
        scope: {},
      })
    ).rejects.toMatchObject({ code: 'player_not_found', status: 404 });
    expect(fileUploadMock).not.toHaveBeenCalled();
  });

  test('forbids non-admin without club/team access', async () => {
    await expect(
      service.submit({
        actorId: 'staff',
        playerId: 'player-1',
        file: buildFile(),
        scope: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
      })
    ).rejects.toMatchObject({ code: 'photo_request_forbidden', status: 403 });
    expect(fileUploadMock).not.toHaveBeenCalled();
  });

  test('forbids when staff has access but player not linked', async () => {
    await expect(
      service.submit({
        actorId: 'staff',
        playerId: 'player-1',
        file: buildFile(),
        scope: {
          isAdmin: false,
          allowedClubIds: ['club-1'],
          allowedTeamIds: [],
        },
      })
    ).rejects.toMatchObject({ code: 'photo_request_forbidden', status: 403 });
    expect(clubPlayerCountMock).toHaveBeenCalled();
    expect(fileUploadMock).not.toHaveBeenCalled();
  });

  test('propagates already existing pending request', async () => {
    photoRequestFindOneMock.mockImplementationOnce(async (query) => {
      expect(query?.include?.[0]?.where?.alias).toBe('pending');
      return { id: 'existing' };
    });
    await expect(
      service.submit({
        actorId: 'admin',
        playerId: 'player-1',
        file: buildFile(),
        scope: { isAdmin: true },
      })
    ).rejects.toMatchObject({
      code: 'photo_request_already_exists',
      status: 400,
    });
    expect(fileUploadMock).not.toHaveBeenCalled();
  });

  test('ignores approved photo requests when submitting a new one', async () => {
    photoRequestFindOneMock.mockImplementationOnce(async (query) => {
      expect(query?.include?.[0]?.where?.alias).toBe('pending');
      return null;
    });

    await expect(
      service.submit({
        actorId: 'admin',
        playerId: 'player-1',
        file: buildFile(),
        scope: { isAdmin: true },
      })
    ).resolves.toEqual({ id: 'req-1' });
    expect(photoRequestCreateMock).toHaveBeenCalled();
  });
});
