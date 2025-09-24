import { beforeEach, expect, jest, test, describe } from '@jest/globals';

// Base service mocks
const listMock = jest.fn();
const syncExternalMock = jest.fn();
const facetsMock = jest.fn();
const seasonBirthYearCountsMock = jest.fn().mockResolvedValue([]);
const seasonTeamSummariesMock = jest.fn().mockResolvedValue([]);

const runWithSyncStateMock = jest.fn(async (job, runner) => {
  const outcome = await runner({ mode: 'incremental', since: null });
  return {
    mode: 'incremental',
    cursor: outcome.cursor,
    outcome,
    state: { job },
  };
});

jest.unstable_mockModule('../src/services/playerService.js', () => ({
  __esModule: true,
  default: {
    list: listMock,
    syncExternal: syncExternalMock,
    facets: facetsMock,
  },
  // Named exports used by controller in other endpoints
  seasonBirthYearCounts: seasonBirthYearCountsMock,
  seasonTeamSummaries: seasonTeamSummariesMock,
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
let externalAvailable = false;
jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  isExternalDbAvailable: () => externalAvailable,
}));
jest.unstable_mockModule('../src/services/syncStateService.js', () => ({
  __esModule: true,
  runWithSyncState: (...args) => runWithSyncStateMock(...args),
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
  externalAvailable = false;
  jest.clearAllMocks();
  runWithSyncStateMock.mockReset().mockImplementation(async (job, runner) => {
    const outcome = await runner({ mode: 'incremental', since: null });
    return {
      mode: 'incremental',
      cursor: outcome.cursor,
      outcome,
      state: { job },
    };
  });
  seasonBirthYearCountsMock.mockReset().mockResolvedValue([]);
  seasonTeamSummariesMock.mockReset().mockResolvedValue([]);
});

describe('playerController sync', () => {
  test('returns 503 when external DB unavailable', async () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.sync({ user: { id: 'u' } }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'external_unavailable' });
  });

  test('sync returns stats and players when external is available', async () => {
    externalAvailable = true;
    listMock.mockResolvedValue({ rows: [{ id: 'p1' }], count: 1 });
    syncExternalMock.mockResolvedValue({ upserted: 1, softDeleted: 0 });
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await controller.sync({ user: { id: 'admin' } }, res);
    expect(syncExternalMock).toHaveBeenCalledWith({
      actorId: 'admin',
      mode: 'incremental',
      since: null,
    });
    expect(listMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        players: [{ id: 'p1' }],
        total: 1,
        stats: expect.any(Object),
      })
    );
  });
});

describe('playerController scoped facets and summaries', () => {
  test('seasonSummary aggregates seasons within staff scope', async () => {
    seasonBirthYearCountsMock.mockResolvedValue([
      {
        season_id: 's1',
        season_name: 'Season 1',
        season_active: true,
        birth_year: 2005,
        player_count: 4,
      },
      {
        season_id: 's1',
        season_name: 'Season 1',
        season_active: true,
        birth_year: 2006,
        player_count: 2,
      },
      {
        season_id: 's2',
        season_name: 'Season 2',
        season_active: false,
        birth_year: 2007,
        player_count: 3,
      },
    ]);
    const req = {
      query: { mine: 'true' },
      access: {
        isAdmin: false,
        allowedClubIds: ['c1'],
        allowedTeamIds: ['t1'],
      },
    };
    const res = { json: jest.fn() };

    await controller.seasonSummary(req, res);

    expect(seasonBirthYearCountsMock).toHaveBeenCalledWith({
      clubIds: ['c1'],
      teamIds: ['t1'],
    });
    expect(res.json).toHaveBeenCalledWith({
      seasons: [
        {
          id: 's1',
          name: 'Season 1',
          active: true,
          years: [
            { year: 2005, count: 4 },
            { year: 2006, count: 2 },
          ],
        },
        {
          id: 's2',
          name: 'Season 2',
          active: false,
          years: [{ year: 2007, count: 3 }],
        },
      ],
    });
  });

  test('seasonSummary denies access when scoped staff has no clubs', async () => {
    const req = {
      query: { mine: 'true', club_id: 'c9' },
      access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.seasonSummary(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Доступ запрещён' });
    expect(seasonBirthYearCountsMock).not.toHaveBeenCalled();
  });

  test('facets forwards filters within club scope', async () => {
    const payload = { seasons: ['s1'], roles: ['Forward'] };
    facetsMock.mockResolvedValue(payload);
    const req = {
      query: {
        search: 'иван',
        season: 's1',
        club_id: 'c1',
        team_id: 't1',
        birth_year: '2005',
        mine: 'true',
      },
      access: {
        isAdmin: false,
        allowedClubIds: ['c1', 'c2'],
        allowedTeamIds: ['t1'],
      },
    };
    const res = { json: jest.fn() };

    await controller.facets(req, res);

    expect(facetsMock).toHaveBeenCalledWith({
      search: 'иван',
      seasonId: 's1',
      teamId: 't1',
      birthYear: 2005,
      clubIds: ['c1'],
    });
    expect(res.json).toHaveBeenCalledWith(payload);
  });

  test('facets denies staff outside permitted clubs', async () => {
    const req = {
      query: { mine: 'false', club_id: 'c9' },
      access: { isAdmin: false, allowedClubIds: ['c1'], allowedTeamIds: [] },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.facets(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Доступ запрещён' });
    expect(facetsMock).not.toHaveBeenCalled();
  });

  test('seasonTeamSummary sorts teams inside each season bucket', async () => {
    seasonTeamSummariesMock.mockResolvedValue([
      {
        season_id: 's1',
        season_name: 'Season 1',
        season_active: true,
        team_id: 't2',
        team_name: 'Beta',
        birth_year: 2008,
        player_count: 9,
        tournaments: ['Cup'],
      },
      {
        season_id: 's1',
        season_name: 'Season 1',
        season_active: true,
        team_id: 't1',
        team_name: 'Alpha',
        birth_year: 2009,
        player_count: 7,
        tournaments: ['League'],
      },
    ]);
    const req = {
      query: { mine: 'true' },
      access: {
        isAdmin: false,
        allowedClubIds: ['c1'],
        allowedTeamIds: ['t1', 't2'],
      },
    };
    const res = { json: jest.fn() };

    await controller.seasonTeamSummary(req, res);

    expect(seasonTeamSummariesMock).toHaveBeenCalledWith({
      clubIds: ['c1'],
      teamIds: ['t1', 't2'],
    });
    expect(res.json).toHaveBeenCalledWith({
      seasons: [
        {
          id: 's1',
          name: 'Season 1',
          active: true,
          teams: [
            {
              team_id: 't1',
              team_name: 'Alpha',
              birth_year: 2009,
              player_count: 7,
              tournaments: ['League'],
            },
            {
              team_id: 't2',
              team_name: 'Beta',
              birth_year: 2008,
              player_count: 9,
              tournaments: ['Cup'],
            },
          ],
        },
      ],
    });
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
