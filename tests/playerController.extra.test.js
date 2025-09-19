import { beforeEach, expect, jest, test, describe } from '@jest/globals';

// Base service mocks
const listMock = jest.fn();
const syncExternalMock = jest.fn();
const facetsMock = jest.fn();

jest.unstable_mockModule('../src/services/playerService.js', () => ({
  __esModule: true,
  default: {
    list: listMock,
    syncExternal: syncExternalMock,
    facets: facetsMock,
  },
  // Named exports used by controller in other endpoints
  seasonBirthYearCounts: jest.fn().mockResolvedValue([]),
  seasonTeamSummaries: jest.fn().mockResolvedValue([]),
}));
jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: {
    syncExternal: jest.fn().mockResolvedValue({ upserted: 0, softDeleted: 0 }),
  },
}));
jest.unstable_mockModule('../src/services/clubService.js', () => ({
  __esModule: true,
  default: {
    syncExternal: jest.fn().mockResolvedValue({ upserted: 0, softDeleted: 0 }),
  },
}));
jest.unstable_mockModule('../src/mappers/playerMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (p) => ({ ...p }) },
}));

// Default: external unavailable for sync tests; will be remocked as needed
jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  isExternalDbAvailable: () => false,
}));

// Models to support mapping paths
const playerRoleFindAll = jest.fn();
const clubPlayerFindAll = jest.fn();

const buildModelStub = () => ({
  findByPk: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
});

const modelsMock = { __esModule: true };
Object.defineProperty(modelsMock, 'PlayerRole', {
  value: { findAll: playerRoleFindAll },
  enumerable: true,
});
Object.defineProperty(modelsMock, 'ClubPlayer', {
  value: { findAll: clubPlayerFindAll },
  enumerable: true,
});

[
  'File',
  'Player',
  'PlayerPhotoRequest',
  'PlayerPhotoRequestStatus',
  'Club',
  'Team',
  'ExtFile',
  'TeamPlayer',
  'User',
  'MedicalCertificate',
  'MedicalCertificateFile',
  'MedicalCertificateType',
  'Ticket',
  'TicketFile',
].forEach((name) => {
  Object.defineProperty(modelsMock, name, {
    value: buildModelStub(),
    enumerable: true,
  });
});

jest.unstable_mockModule('../src/models/index.js', () => modelsMock);

const { default: controller } = await import(
  '../src/controllers/playerController.js'
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('playerController sync', () => {
  test('returns 503 when external DB unavailable', async () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.sync({ user: { id: 'u' } }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'external_unavailable' });
  });

  test('sync returns stats and players when external is available', async () => {
    jest.resetModules();
    const listMock2 = jest
      .fn()
      .mockResolvedValue({ rows: [{ id: 'p1' }], count: 1 });
    const playerSyncMock2 = jest
      .fn()
      .mockResolvedValue({ upserted: 1, softDeleted: 0 });
    jest.unstable_mockModule('../src/services/playerService.js', () => ({
      __esModule: true,
      default: { list: listMock2, syncExternal: playerSyncMock2 },
      seasonBirthYearCounts: jest.fn().mockResolvedValue([]),
      seasonTeamSummaries: jest.fn().mockResolvedValue([]),
    }));
    jest.unstable_mockModule('../src/services/teamService.js', () => ({
      __esModule: true,
      default: {
        syncExternal: jest
          .fn()
          .mockResolvedValue({ upserted: 0, softDeleted: 0 }),
      },
    }));
    jest.unstable_mockModule('../src/services/clubService.js', () => ({
      __esModule: true,
      default: {
        syncExternal: jest
          .fn()
          .mockResolvedValue({ upserted: 0, softDeleted: 0 }),
      },
    }));
    jest.unstable_mockModule('../src/mappers/playerMapper.js', () => ({
      __esModule: true,
      default: { toPublic: (p) => p },
    }));
    jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
      __esModule: true,
      isExternalDbAvailable: () => true,
    }));
    const { default: controller2 } = await import(
      '../src/controllers/playerController.js'
    );
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await controller2.sync({ user: { id: 'admin' } }, res);
    expect(playerSyncMock2).toHaveBeenCalled();
    expect(listMock2).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ players: [{ id: 'p1' }], total: 1 })
    );
  });
});

describe('playerController list mapping', () => {
  test('injects jersey_number and role_name when single club context', async () => {
    // Single club context: clubIds length === 1
    listMock.mockResolvedValue({
      rows: [
        {
          id: 'p1',
          Clubs: [
            { id: 'c1', ClubPlayer: { number: 77, role_id: 5 } },
            { id: 'c2', ClubPlayer: { number: 10, role_id: 99 } },
          ],
        },
      ],
      count: 1,
    });
    playerRoleFindAll.mockResolvedValue([{ id: 5, name: 'Forward' }]);

    const req = {
      query: { page: '1', limit: '10', club_id: 'c1' },
      access: { isAdmin: true },
    };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await controller.list(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.players[0].jersey_number).toBe(77);
    expect(payload.players[0].role_name).toBe('Forward');
  });

  test('injects jersey_number and role_name in roster context', async () => {
    listMock.mockResolvedValue({
      rows: [
        {
          id: 'p2',
          Teams: [
            { TeamPlayer: { club_player_id: 15 } },
            { TeamPlayer: { club_player_id: null } },
          ],
        },
      ],
      count: 1,
    });
    clubPlayerFindAll.mockResolvedValue([
      { id: 15, number: 9, PlayerRole: { name: 'Goalkeeper' } },
    ]);

    const req = {
      query: { page: '1', limit: '10', season: 's1', team_birth_year: '2010' },
      access: { isAdmin: true },
    };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await controller.list(req, res);
    const out = res.json.mock.calls[0][0];
    expect(out.players[0].jersey_number).toBe(9);
    expect(out.players[0].role_name).toBe('Goalkeeper');
  });
});
