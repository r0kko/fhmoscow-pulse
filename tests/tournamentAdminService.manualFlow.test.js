import { beforeEach, expect, jest, test } from '@jest/globals';

const tournamentFindByPkMock = jest.fn();
const stageFindByPkMock = jest.fn();
const groupFindByPkMock = jest.fn();
const teamFindByPkMock = jest.fn();
const ttFindOneMock = jest.fn();
const ttFindByPkMock = jest.fn();
const ttCreateMock = jest.fn();
const ttFindAllMock = jest.fn();
const matchCreateMock = jest.fn();
const matchFindByPkMock = jest.fn();
const gameStatusFindOneMock = jest.fn();
const groundFindByPkMock = jest.fn();

beforeEach(() => {
  tournamentFindByPkMock.mockReset();
  stageFindByPkMock.mockReset();
  groupFindByPkMock.mockReset();
  teamFindByPkMock.mockReset();
  ttFindOneMock.mockReset();
  ttFindByPkMock.mockReset();
  ttCreateMock.mockReset();
  ttFindAllMock.mockReset();
  matchCreateMock.mockReset();
  matchFindByPkMock.mockReset();
  gameStatusFindOneMock.mockReset();
  groundFindByPkMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Tournament: {
    findAndCountAll: jest.fn(),
    findByPk: tournamentFindByPkMock,
  },
  TournamentType: { findAll: jest.fn() },
  CompetitionType: { findAll: jest.fn(), findByPk: jest.fn() },
  ScheduleManagementType: { findAll: jest.fn(), findByPk: jest.fn() },
  Stage: {
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: stageFindByPkMock,
  },
  TournamentGroup: {
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: groupFindByPkMock,
  },
  TournamentTeam: {
    findAll: ttFindAllMock,
    findAndCountAll: jest.fn(),
    findOne: ttFindOneMock,
    findByPk: ttFindByPkMock,
    create: ttCreateMock,
  },
  RefereeRoleGroup: { findAll: jest.fn() },
  RefereeRole: { findAll: jest.fn() },
  TournamentGroupReferee: { findAll: jest.fn(), destroy: jest.fn() },
  Season: { findByPk: jest.fn() },
  Team: { findByPk: teamFindByPkMock },
  Ground: { findByPk: groundFindByPkMock },
  Match: {
    findAndCountAll: jest.fn(),
    create: matchCreateMock,
    findByPk: matchFindByPkMock,
  },
  GameStatus: {
    findOne: gameStatusFindOneMock,
  },
}));

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: jest.fn(async (cb) => cb({})) },
}));

const { default: svc } =
  await import('../src/services/tournamentAdminService.js');

test('assignTeamToGroup rejects imported tournaments', async () => {
  tournamentFindByPkMock.mockResolvedValue({ id: 't1', external_id: 7 });
  groupFindByPkMock.mockResolvedValue({ id: 'g1', tournament_id: 't1' });
  teamFindByPkMock.mockResolvedValue({ id: 'team1' });

  await expect(
    svc.assignTeamToGroup({
      tournament_id: 't1',
      group_id: 'g1',
      team_id: 'team1',
    })
  ).rejects.toMatchObject({ code: 'tournament_is_imported' });
});

test('assignTeamToGroup creates a new assignment for manual tournament', async () => {
  tournamentFindByPkMock.mockResolvedValue({ id: 't1', external_id: null });
  groupFindByPkMock.mockResolvedValue({ id: 'g1', tournament_id: 't1' });
  teamFindByPkMock.mockResolvedValue({ id: 'team1' });
  ttFindOneMock.mockResolvedValue(null);
  ttCreateMock.mockResolvedValue({ id: 'tt1' });
  ttFindByPkMock.mockResolvedValue({ id: 'tt1' });

  const out = await svc.assignTeamToGroup(
    {
      tournament_id: 't1',
      group_id: 'g1',
      team_id: 'team1',
    },
    'admin-1'
  );

  expect(ttCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: null,
      tournament_id: 't1',
      tournament_group_id: 'g1',
      team_id: 'team1',
      created_by: 'admin-1',
      updated_by: 'admin-1',
    })
  );
  expect(out).toEqual({ id: 'tt1' });
});

test('createMatchSchedule creates a stage match for two tournament teams', async () => {
  tournamentFindByPkMock.mockResolvedValue({
    id: 't1',
    external_id: null,
    season_id: 'season-1',
  });
  stageFindByPkMock.mockResolvedValue({ id: 's1', tournament_id: 't1' });
  ttFindAllMock.mockResolvedValue([
    { team_id: 'home', tournament_group_id: 'g-home' },
    { team_id: 'away', tournament_group_id: 'g-away' },
  ]);
  gameStatusFindOneMock.mockResolvedValue({ id: 'status-1' });
  groundFindByPkMock.mockResolvedValue({ id: 'ground-1' });
  matchCreateMock.mockResolvedValue({ id: 'm1' });
  matchFindByPkMock.mockResolvedValue({ id: 'm1' });

  const out = await svc.createMatchSchedule(
    {
      tournament_id: 't1',
      stage_id: 's1',
      home_team_id: 'home',
      away_team_id: 'away',
      ground_id: 'ground-1',
      date_start: '2026-02-07T10:30:00.000Z',
    },
    'admin-2'
  );

  expect(matchCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: null,
      tournament_id: 't1',
      stage_id: 's1',
      tournament_group_id: 'g-home',
      season_id: 'season-1',
      ground_id: 'ground-1',
      team1_id: 'home',
      team2_id: 'away',
      game_status_id: 'status-1',
      created_by: 'admin-2',
      updated_by: 'admin-2',
    })
  );
  expect(out).toEqual({ id: 'm1' });
});

test('createMatchSchedule rejects same team on both sides', async () => {
  await expect(
    svc.createMatchSchedule({
      tournament_id: 't1',
      stage_id: 's1',
      home_team_id: 'team-x',
      away_team_id: 'team-x',
      date_start: '2026-02-07T10:30:00.000Z',
    })
  ).rejects.toMatchObject({ code: 'match_teams_must_differ' });
});

test('createMatchSchedule rejects unknown ground', async () => {
  tournamentFindByPkMock.mockResolvedValue({
    id: 't1',
    external_id: null,
    season_id: 'season-1',
  });
  stageFindByPkMock.mockResolvedValue({ id: 's1', tournament_id: 't1' });
  ttFindAllMock.mockResolvedValue([
    { team_id: 'home', tournament_group_id: 'g-home' },
    { team_id: 'away', tournament_group_id: 'g-away' },
  ]);
  groundFindByPkMock.mockResolvedValue(null);

  await expect(
    svc.createMatchSchedule({
      tournament_id: 't1',
      stage_id: 's1',
      home_team_id: 'home',
      away_team_id: 'away',
      ground_id: 'missing-ground',
      date_start: '2026-02-07T10:30:00.000Z',
    })
  ).rejects.toMatchObject({ code: 'ground_not_found' });
});

test('createMatchSchedule rejects when first team has no group assignment', async () => {
  tournamentFindByPkMock.mockResolvedValue({
    id: 't1',
    external_id: null,
    season_id: 'season-1',
  });
  stageFindByPkMock.mockResolvedValue({ id: 's1', tournament_id: 't1' });
  ttFindAllMock.mockResolvedValue([
    { team_id: 'home', tournament_group_id: null },
    { team_id: 'away', tournament_group_id: 'g-away' },
  ]);

  await expect(
    svc.createMatchSchedule({
      tournament_id: 't1',
      stage_id: 's1',
      home_team_id: 'home',
      away_team_id: 'away',
      date_start: '2026-02-07T10:30:00.000Z',
    })
  ).rejects.toMatchObject({ code: 'home_team_group_required' });
});
