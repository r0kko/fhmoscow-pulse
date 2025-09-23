import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const tx = { id: 'tx' };

const findMatchMock = jest.fn();
const findUserMock = jest.fn();
const findTeamPlayerMock = jest.fn();
const findMatchPlayerMock = jest.fn();
const createMatchPlayerMock = jest.fn();
const findRolesMock = jest.fn();
const teamFindAllMock = jest.fn();

function makeUser({ teams = [], roles = [], clubs = [] } = {}) {
  return {
    Teams: teams,
    Roles: roles,
    UserClubs: clubs,
  };
}

beforeEach(() => {
  findMatchMock.mockReset();
  findUserMock.mockReset();
  findTeamPlayerMock.mockReset();
  findMatchPlayerMock.mockReset();
  createMatchPlayerMock.mockReset();
  findRolesMock.mockReset();
  findMatchPlayerMock.mockImplementation(async () => []);
  createMatchPlayerMock.mockImplementation(async () => ({}));
  findRolesMock.mockResolvedValue([]);
  teamFindAllMock.mockReset().mockResolvedValue([]);
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: {
    transaction: (fn) => fn(tx),
    literal: (value) => value,
  },
}));

const buildRow = (overrides = {}) => ({
  id: overrides.id || overrides.team_player_id || 'mp1',
  team_player_id: overrides.team_player_id || 'tp-1',
  team_id: overrides.team_id || 't1',
  deletedAt: overrides.deletedAt ?? null,
  number: overrides.number ?? null,
  role_id: overrides.role_id ?? null,
  is_captain: overrides.is_captain ?? false,
  assistant_order: overrides.assistant_order ?? null,
  squad_no: overrides.squad_no ?? null,
  squad_both: overrides.squad_both ?? false,
  update: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  restore: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: findMatchMock },
  Team: { findAll: teamFindAllMock },
  User: { findByPk: findUserMock },
  TeamPlayer: { findAll: findTeamPlayerMock },
  ClubPlayer: {},
  Player: {},
  PlayerRole: { findAll: findRolesMock },
  MatchPlayer: {
    findAll: findMatchPlayerMock,
    create: createMatchPlayerMock.mockImplementation(async (payload) =>
      buildRow({ ...payload, id: `new-${payload.team_player_id}` })
    ),
  },
  Role: {},
  UserClub: {},
  SportSchoolPosition: {},
  Tournament: {},
  TournamentType: {},
  Stage: {},
  TournamentGroup: {},
  Tour: {},
}));

jest.unstable_mockModule('../src/models/role.js', () => ({
  __esModule: true,
  default: {},
}));

const { default: service } = await import(
  '../src/services/matchLineupService.js'
);

function baseMatch(overrides = {}) {
  return {
    id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    season_id: 's1',
    HomeTeam: { name: 'Home' },
    AwayTeam: { name: 'Away' },
    Tournament: {
      name: 'Cup',
      TournamentType: { double_protocol: false },
    },
    Stage: { name: 'Stage' },
    TournamentGroup: { name: 'Group' },
    Tour: { name: 'Tour' },
    ...overrides,
  };
}

describe('matchLineupService list', () => {
  test('throws 404 when match not found', async () => {
    findMatchMock.mockResolvedValue(null);
    await expect(service.list('missing', 'actor')).rejects.toMatchObject({
      message: 'match_not_found',
      code: 404,
    });
  });

  test('throws 403 when actor not related to match', async () => {
    findMatchMock.mockResolvedValue(baseMatch());
    findUserMock.mockResolvedValue(makeUser({ teams: [], roles: [] }));
    await expect(service.list('m1', 'actor')).rejects.toMatchObject({
      message: 'forbidden_not_match_member',
      code: 403,
    });
  });

  test('returns enriched roster with revisions', async () => {
    findMatchMock.mockResolvedValue(baseMatch());
    findUserMock.mockResolvedValue(
      makeUser({ teams: [{ id: 't1' }], roles: [] })
    );
    findTeamPlayerMock
      .mockResolvedValueOnce([
        {
          id: 'tp1',
          player_id: 'p1',
          Player: { surname: 'Иванов', name: 'Иван' },
          ClubPlayer: {
            number: 31,
            PlayerRole: { id: 'r1', name: 'Goalkeeper' },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'tp3',
          player_id: 'p3',
          Player: { surname: 'Петров', name: 'Петр' },
          ClubPlayer: null,
        },
      ]);
    findMatchPlayerMock.mockResolvedValueOnce([
      buildRow({
        team_player_id: 'tp1',
        team_id: 't1',
        number: 99,
        role_id: 'r1',
        is_captain: true,
        assistant_order: null,
        squad_no: 1,
        squad_both: false,
        PlayerRole: { id: 'r1', name: 'Goalkeeper' },
      }),
      buildRow({
        team_player_id: 'tp3',
        team_id: 't2',
        number: 7,
        role_id: null,
        is_captain: false,
        assistant_order: 1,
        squad_no: null,
        squad_both: false,
        PlayerRole: null,
      }),
    ]);
    findRolesMock.mockResolvedValue([
      { id: 'r1', name: 'Goalkeeper' },
      { id: 'r2', name: 'Forward' },
    ]);

    const res = await service.list('m1', 'actor');
    expect(res.home.players[0]).toMatchObject({
      team_player_id: 'tp1',
      selected: true,
      match_number: 99,
      match_role: { id: 'r1', name: 'Goalkeeper' },
      is_gk: true,
      is_captain: true,
      squad_no: 1,
    });
    expect(res.away.players[0]).toMatchObject({
      team_player_id: 'tp3',
      selected: true,
      match_role: null,
      assistant_order: 1,
    });
    expect(typeof res.home_rev).toBe('string');
    expect(typeof res.away_rev).toBe('string');
    expect(res.roles).toHaveLength(2);
    expect(res.permissions).toMatchObject({
      lineups: { allowed: true },
    });
  });

  test('rejects when staff accountant attempts to view', async () => {
    findMatchMock.mockResolvedValue(baseMatch());
    teamFindAllMock.mockResolvedValue([{ id: 't1', club_id: 'club1' }]);
    findUserMock.mockResolvedValue(
      makeUser({
        teams: [{ id: 't1', club_id: 'club1' }],
        roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
        clubs: [
          {
            club_id: 'club1',
            SportSchoolPosition: { alias: 'ACCOUNTANT' },
          },
        ],
      })
    );

    await expect(service.list('m1', 'accountant')).rejects.toMatchObject({
      message: 'staff_position_restricted',
      code: 403,
    });
  });

  test('rejects when staff media manager attempts to view', async () => {
    findMatchMock.mockResolvedValue(baseMatch());
    teamFindAllMock.mockResolvedValue([{ id: 't2', club_id: 'club2' }]);
    findUserMock.mockResolvedValue(
      makeUser({
        teams: [{ id: 't2', club_id: 'club2' }],
        roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
        clubs: [
          {
            club_id: 'club2',
            SportSchoolPosition: { alias: 'MEDIA_MANAGER' },
          },
        ],
      })
    );

    await expect(service.list('m1', 'media')).rejects.toMatchObject({
      message: 'staff_position_restricted',
      code: 403,
    });
  });
});

describe('matchLineupService set', () => {
  test('rejects when team is not part of match', async () => {
    findMatchMock.mockResolvedValue(baseMatch());
    await expect(service.set('m1', 'other', [], 'actor')).rejects.toMatchObject(
      {
        message: 'team_not_in_match',
        code: 400,
      }
    );
  });

  test('rejects when actor is not team member nor admin', async () => {
    findMatchMock.mockResolvedValue(baseMatch());
    findUserMock.mockResolvedValue(makeUser({ teams: [], roles: [] }));
    await expect(service.set('m1', 't1', [], 'actor')).rejects.toMatchObject({
      message: 'forbidden_not_match_member',
      code: 403,
    });
  });

  test('rejects when selected player is not in team', async () => {
    findMatchMock.mockResolvedValue(baseMatch());
    findUserMock.mockResolvedValue(
      makeUser({ teams: [{ id: 't1' }], roles: [] })
    );
    findTeamPlayerMock.mockResolvedValue([{ id: 'tp-1' }]);

    await expect(
      service.set(
        'm1',
        't1',
        [{ team_player_id: 'tp-x', selected: true }],
        'actor'
      )
    ).rejects.toMatchObject({
      message: 'player_not_in_team',
      code: 400,
    });
  });

  test('creates lineup records and returns new revision', async () => {
    findMatchMock.mockResolvedValue(baseMatch());
    findUserMock.mockResolvedValue(
      makeUser({ teams: [{ id: 't1' }], roles: [] })
    );
    findTeamPlayerMock.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

    findMatchPlayerMock
      .mockResolvedValueOnce([]) // existing inside transaction
      .mockResolvedValueOnce([
        {
          team_player_id: 'p1',
          team_id: 't1',
          number: 1,
          role_id: 'r1',
          is_captain: false,
          assistant_order: null,
          squad_no: null,
          squad_both: false,
        },
        {
          team_player_id: 'p2',
          team_id: 't1',
          number: 10,
          role_id: 'r2',
          is_captain: true,
          assistant_order: null,
          squad_no: null,
          squad_both: false,
        },
      ]);
    findRolesMock.mockResolvedValue([
      { id: 'r1', name: 'goalkeeper' },
      { id: 'r2', name: 'forward' },
    ]);

    const detailed = [
      {
        team_player_id: 'p1',
        selected: true,
        number: '1',
        role_id: 'r1',
        is_captain: false,
        assistant_order: null,
        squad_no: null,
        squad_both: false,
      },
      {
        team_player_id: 'p2',
        selected: true,
        number: '10',
        role_id: 'r2',
        is_captain: true,
        assistant_order: null,
        squad_no: null,
        squad_both: false,
      },
      {
        team_player_id: 'p3',
        selected: false,
      },
    ];

    const res = await service.set('m1', 't1', detailed, 'actor');

    expect(createMatchPlayerMock).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ ok: true });
    expect(typeof res.team_rev).toBe('string');
  });

  test('enforces double-protocol goalkeeper constraints', async () => {
    findMatchMock.mockResolvedValue(
      baseMatch({
        Tournament: {
          name: 'Cup',
          TournamentType: { double_protocol: true },
        },
      })
    );
    findUserMock.mockResolvedValue(
      makeUser({ teams: [{ id: 't1' }], roles: [] })
    );
    findTeamPlayerMock.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    findRolesMock.mockResolvedValue([
      { id: 'r1', name: 'Goalkeeper' },
      { id: 'r2', name: 'Forward' },
    ]);
    findMatchPlayerMock.mockResolvedValueOnce([]);

    const detailed = [
      {
        team_player_id: 'p1',
        selected: true,
        number: '1',
        role_id: 'r1',
        is_captain: false,
        assistant_order: null,
        squad_no: 1,
        squad_both: true,
      },
      {
        team_player_id: 'p2',
        selected: true,
        number: '2',
        role_id: 'r2',
        is_captain: false,
        assistant_order: null,
        squad_no: 1,
      },
    ];

    await expect(
      service.set('m1', 't1', detailed, 'actor')
    ).rejects.toMatchObject({
      message: 'gk_both_requires_three',
      code: 400,
    });
  });

  test('rejects accountant editing lineup', async () => {
    findMatchMock.mockResolvedValue(baseMatch());
    teamFindAllMock.mockResolvedValue([{ id: 't1', club_id: 'club1' }]);
    findUserMock.mockResolvedValue(
      makeUser({
        teams: [{ id: 't1', club_id: 'club1' }],
        roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
        clubs: [
          {
            club_id: 'club1',
            SportSchoolPosition: { alias: 'ACCOUNTANT' },
          },
        ],
      })
    );

    await expect(
      service.set('m1', 't1', [], 'accountant')
    ).rejects.toMatchObject({
      message: 'staff_position_restricted',
      code: 403,
    });
  });
});
