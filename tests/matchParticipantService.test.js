import { beforeEach, expect, jest, test } from '@jest/globals';

const matchFindByPkMock = jest.fn();
const userFindByPkMock = jest.fn();
const teamFindAllMock = jest.fn();
const participantPlayerFindAllMock = jest.fn();
const participantStaffFindAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: matchFindByPkMock },
  User: { findByPk: userFindByPkMock },
  Team: { findAll: teamFindAllMock },
  Role: {},
  UserClub: {},
  SportSchoolPosition: {},
  Tournament: {},
  TournamentType: {},
  ScheduleManagementType: {},
  MatchParticipantPlayer: { findAll: participantPlayerFindAllMock },
  MatchParticipantStaff: { findAll: participantStaffFindAllMock },
  Player: {},
  Staff: {},
  PlayerRole: {},
}));

const service = (await import('../src/services/matchParticipantService.js'))
  .default;

function matchRow() {
  return {
    id: 'match-1',
    team1_id: 'team-home',
    team2_id: 'team-away',
    tournament_id: 'tournament-1',
    HomeTeam: { id: 'team-home', name: 'Хозяева' },
    AwayTeam: { id: 'team-away', name: 'Гости' },
    Tournament: {
      TournamentType: { double_protocol: false },
      ScheduleManagementType: null,
    },
  };
}

beforeEach(() => {
  matchFindByPkMock.mockReset();
  userFindByPkMock.mockReset();
  teamFindAllMock.mockReset().mockResolvedValue([]);
  participantPlayerFindAllMock.mockReset();
  participantStaffFindAllMock.mockReset();
});

test('list groups imported participants by home and away side', async () => {
  matchFindByPkMock.mockResolvedValue(matchRow());
  userFindByPkMock.mockResolvedValue({
    Teams: [{ id: 'team-home', club_id: 'club-home' }],
    Roles: [],
    UserClubs: [],
  });
  participantPlayerFindAllMock.mockResolvedValue([
    {
      id: 'row-player-home',
      external_id: 1001,
      external_game_id: 501,
      external_team_id: 10,
      external_player_id: 777,
      match_id: 'match-1',
      team_id: 'team-home',
      player_id: 'player-home',
      team_side: 1,
      Team: { name: 'Хозяева' },
      Player: { surname: 'Иванов', name: 'Иван' },
      PlayerRole: { name: 'Вратарь' },
      number: 31,
      role_id: 'role-gk',
      role_external_id: 1,
      role_name: 'Вратарь',
      role_abbreviation: 'ВР',
      match_position_external_id: 3,
      match_position_name: 'Игрок',
      match_position_abbreviation: 'И',
      lineup_number: 1,
      played: true,
      played_in_lineup: 1,
    },
    {
      id: 'row-player-away',
      external_id: 1002,
      external_game_id: 501,
      external_team_id: 20,
      external_player_id: 778,
      match_id: 'match-1',
      team_id: 'team-away',
      player_id: 'player-away',
      team_side: 2,
      Team: { name: 'Гости' },
      Player: { surname: 'Петров', name: 'Петр' },
      PlayerRole: { name: 'Нападающий' },
      number: 9,
      role_id: 'role-forward',
      role_external_id: 3,
      role_name: 'Нападающий',
      role_abbreviation: 'НП',
      match_position_external_id: 1,
      match_position_name: 'Капитан',
      match_position_abbreviation: 'К',
      lineup_number: null,
      played: null,
      played_in_lineup: null,
    },
  ]);
  participantStaffFindAllMock.mockResolvedValue([
    {
      id: 'row-staff-home',
      external_id: 2001,
      external_game_id: 501,
      external_team_id: 10,
      external_staff_id: 888,
      match_id: 'match-1',
      team_id: 'team-home',
      staff_id: 'staff-home',
      team_side: 1,
      Team: { name: 'Хозяева' },
      Staff: { surname: 'Сидоров', name: 'Сидор' },
      position: 'Главный тренер',
    },
  ]);

  const result = await service.list('match-1', 'user-1');

  expect(result).toMatchObject({
    match_id: 'match-1',
    synced_snapshot: true,
    home: {
      team_id: 'team-home',
      team_name: 'Хозяева',
      players: [
        expect.objectContaining({
          external_id: 1001,
          full_name: 'Иванов Иван',
          number: 31,
          played: true,
        }),
      ],
      staff: [
        expect.objectContaining({
          external_id: 2001,
          full_name: 'Сидоров Сидор',
          position: 'Главный тренер',
        }),
      ],
    },
    away: {
      team_id: 'team-away',
      players: [
        expect.objectContaining({
          external_id: 1002,
          full_name: 'Петров Петр',
          played: null,
        }),
      ],
      staff: [],
    },
  });
});

test('list returns empty home and away arrays when no snapshot exists', async () => {
  matchFindByPkMock.mockResolvedValue(matchRow());
  userFindByPkMock.mockResolvedValue({
    Teams: [{ id: 'team-away', club_id: 'club-away' }],
    Roles: [],
    UserClubs: [],
  });
  participantPlayerFindAllMock.mockResolvedValue([]);
  participantStaffFindAllMock.mockResolvedValue([]);

  const result = await service.list('match-1', 'user-1');

  expect(result.home.players).toEqual([]);
  expect(result.home.staff).toEqual([]);
  expect(result.away.players).toEqual([]);
  expect(result.away.staff).toEqual([]);
});

test('list rejects users outside the match', async () => {
  matchFindByPkMock.mockResolvedValue(matchRow());
  userFindByPkMock.mockResolvedValue({
    Teams: [{ id: 'other-team', club_id: 'other-club' }],
    Roles: [],
    UserClubs: [],
  });

  await expect(service.list('match-1', 'user-1')).rejects.toMatchObject({
    message: 'forbidden_not_match_member',
    code: 403,
  });
});
