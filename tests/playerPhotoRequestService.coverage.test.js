import { beforeEach, describe, expect, jest, test } from '@jest/globals';

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
    photoRequestFindOneMock.mockResolvedValue({ id: 'existing' });
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
});
