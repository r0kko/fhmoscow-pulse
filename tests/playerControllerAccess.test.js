import { describe, expect, jest, test } from '@jest/globals';

const listMock = jest.fn().mockResolvedValue({ rows: [], count: 0 });
const facetsMock = jest
  .fn()
  .mockResolvedValue({ teams: [], seasons: [], birthYears: [] });
const seasonBirthYearCountsMock = jest.fn().mockResolvedValue([]);
const seasonTeamSummariesMock = jest.fn().mockResolvedValue([]);

jest.unstable_mockModule('../src/services/playerService.js', () => ({
  __esModule: true,
  default: { list: listMock, facets: facetsMock },
  seasonBirthYearCounts: seasonBirthYearCountsMock,
  seasonTeamSummaries: seasonTeamSummariesMock,
}));
// Mock unrelated services imported by controller to avoid pulling heavy dependencies
jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: { listUserTeams: jest.fn() },
}));
jest.unstable_mockModule('../src/services/clubService.js', () => ({
  __esModule: true,
  default: { list: jest.fn() },
}));
jest.unstable_mockModule('../src/services/clubUserService.js', () => ({
  __esModule: true,
  default: { listUserClubs: jest.fn() },
}));

const { default: controller } = await import(
  '../src/controllers/playerController.js'
);

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('playerController access', () => {
  test('list returns 403 for staff with no allowed clubs/teams', async () => {
    const req = {
      query: { page: '1', limit: '10' },
      access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
    };
    const res = mockRes();
    await controller.list(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('list (mine=true) for admin+staff restricts to personal clubs', async () => {
    listMock.mockClear();
    const req = {
      query: { page: '1', limit: '10', mine: 'true' },
      access: {
        isAdmin: true,
        allowedClubIds: ['cx'],
        allowedTeamIds: ['tx'],
      },
    };
    const res = mockRes();
    await controller.list(req, res);
    expect(listMock).toHaveBeenCalled();
    const arg = listMock.mock.calls[0][0];
    expect(arg.clubIds).toEqual(['cx']);
    expect(arg.allowedTeamIds).toEqual(['tx']);
  });

  test('facets enforces team scope for staff', async () => {
    facetsMock.mockClear();
    const req = {
      query: { team_id: 'x' },
      access: { isAdmin: false, allowedClubIds: ['c1'], allowedTeamIds: [] },
    };
    const res = mockRes();
    await controller.facets(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('facets returns data for admin', async () => {
    facetsMock.mockResolvedValue({
      teams: [{ id: 't1' }],
      seasons: [],
      birthYears: [],
    });
    const req = { query: {}, access: { isAdmin: true } };
    const res = mockRes();
    await controller.facets(req, res);
    expect(res.json).toHaveBeenCalled();
  });

  test('facets returns data for staff when in scope', async () => {
    facetsMock.mockResolvedValue({ teams: [], seasons: [], birthYears: [] });
    const req = {
      query: { team_id: 'tx' },
      access: {
        isAdmin: false,
        allowedClubIds: ['cx'],
        allowedTeamIds: ['tx'],
      },
    };
    const res = mockRes();
    await controller.facets(req, res);
    expect(res.json).toHaveBeenCalled();
  });

  test('seasonSummary with mine=true restricts to allowed clubs', async () => {
    seasonBirthYearCountsMock.mockClear();
    const req = {
      query: { mine: 'true' },
      access: { isAdmin: true, allowedClubIds: ['c1'], allowedTeamIds: [] },
    };
    const res = mockRes();
    await controller.seasonSummary(req, res);
    expect(seasonBirthYearCountsMock).toHaveBeenCalledWith({
      clubIds: ['c1'],
      teamIds: [],
    });
  });

  test('seasonTeamSummary denies when no scope for staff', async () => {
    const req = {
      query: {},
      access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
    };
    const res = mockRes();
    await controller.seasonTeamSummary(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('seasonTeamSummary returns data for staff with club in scope', async () => {
    seasonTeamSummariesMock.mockResolvedValue([]);
    const req = {
      query: { club_id: 'cx' },
      access: { isAdmin: false, allowedClubIds: ['cx'], allowedTeamIds: [] },
    };
    const res = mockRes();
    await controller.seasonTeamSummary(req, res);
    expect(res.json).toHaveBeenCalled();
  });

  test('list for staff with allowed scope calls service', async () => {
    listMock.mockClear();
    const req = {
      query: { team_id: 'tx' },
      access: {
        isAdmin: false,
        allowedClubIds: ['cx'],
        allowedTeamIds: ['tx'],
      },
    };
    const res = mockRes();
    await controller.list(req, res);
    expect(listMock).toHaveBeenCalled();
    const arg = listMock.mock.calls[0][0];
    expect(arg.clubIds).toEqual(['cx']);
    expect(arg.allowedTeamIds).toEqual(['tx']);
  });

  test('list for admin without mine=true uses full access', async () => {
    listMock.mockClear();
    const req = { query: {}, access: { isAdmin: true } };
    const res = mockRes();
    await controller.list(req, res);
    expect(listMock).toHaveBeenCalled();
  });

  test('seasonSummary groups by season and returns response', async () => {
    seasonBirthYearCountsMock.mockResolvedValue([
      {
        season_id: 's1',
        season_name: '2024/25',
        season_active: true,
        birth_year: 2010,
        player_count: 12,
      },
      {
        season_id: 's1',
        season_name: '2024/25',
        season_active: true,
        birth_year: 2011,
        player_count: 8,
      },
      {
        season_id: 's2',
        season_name: '2023/24',
        season_active: false,
        birth_year: 2010,
        player_count: 5,
      },
    ]);
    const req = { query: {}, access: { isAdmin: true } };
    const res = mockRes();
    await controller.seasonSummary(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload.seasons)).toBe(true);
    expect(payload.seasons.length).toBe(2);
  });

  test('seasonSummary denies when staff club filter is out of scope', async () => {
    const req = {
      query: { club_id: 'nope' },
      access: { isAdmin: false, allowedClubIds: ['cx'], allowedTeamIds: [] },
    };
    const res = mockRes();
    await controller.seasonSummary(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('seasonTeamSummary sorts teams by birth_year desc then name', async () => {
    seasonTeamSummariesMock.mockResolvedValue([
      {
        season_id: 's1',
        season_name: '2024/25',
        season_active: true,
        team_id: 't1',
        team_name: 'Beta',
        birth_year: 2010,
        player_count: 10,
        tournaments: [],
      },
      {
        season_id: 's1',
        season_name: '2024/25',
        season_active: true,
        team_id: 't2',
        team_name: 'Alpha',
        birth_year: 2011,
        player_count: 8,
        tournaments: [],
      },
    ]);
    const req = { query: {}, access: { isAdmin: true } };
    const res = mockRes();
    await controller.seasonTeamSummary(req, res);
    const data = res.json.mock.calls[0][0];
    const teams = data.seasons[0].teams;
    expect(teams[0].birth_year).toBe(2011);
    expect(teams[1].birth_year).toBe(2010);
  });
});
