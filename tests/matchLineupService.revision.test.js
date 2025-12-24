import { beforeEach, expect, jest, test } from '@jest/globals';

const tx = { id: 'tx' };

const findMatchMock = jest.fn();
const findUserMock = jest.fn();
const findTpMock = jest.fn();
const findMpMock = jest.fn();
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
  findTpMock.mockReset();
  findMpMock.mockReset();
  findRolesMock.mockReset();
  teamFindAllMock.mockReset().mockResolvedValue([]);
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: {
    transaction: (fn) => fn(tx),
    literal: (s) => s,
  },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: findMatchMock },
  Team: { findAll: teamFindAllMock },
  User: { findByPk: findUserMock },
  TeamPlayer: { findAll: findTpMock },
  ClubPlayer: {},
  Player: {},
  PlayerRole: { findAll: findRolesMock },
  MatchPlayer: { findAll: findMpMock },
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

const { default: service } =
  await import('../src/services/matchLineupService.js');

function baseMatch() {
  return {
    id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    season_id: 's1',
    Tournament: { TournamentType: { double_protocol: false } },
  };
}

test('list returns team revisions', async () => {
  findMatchMock.mockResolvedValue(baseMatch());
  findUserMock.mockResolvedValue(
    makeUser({ teams: [{ id: 't1' }], roles: [] })
  );
  findTpMock.mockResolvedValue([]); // for both teams
  findMpMock.mockResolvedValue([
    { team_player_id: 'a', team_id: 't1', number: 7 },
    { team_player_id: 'b', team_id: 't1', number: 8 },
  ]);
  findRolesMock.mockResolvedValue([]);
  const res = await service.list('m1', 'u1');
  expect(res).toBeTruthy();
  expect(typeof res.home_rev).toBe('string');
  expect(typeof res.away_rev).toBe('string');
  expect(res.permissions).toMatchObject({ lineups: { allowed: true } });
});

test('set throws conflict on mismatched if_match_rev', async () => {
  findMatchMock.mockResolvedValue(baseMatch());
  // ADMIN rights
  findUserMock.mockResolvedValue(
    makeUser({ teams: [], roles: [{ alias: 'ADMIN' }] })
  );
  // Inside transaction, service loads current MatchPlayer rows for team
  findMpMock.mockResolvedValue([
    { team_player_id: 'x1', team_id: 't1', number: 10 },
  ]);
  await expect(
    service.set('m1', 't1', [], 'admin', 'some-mismatch-rev')
  ).rejects.toThrow('conflict_lineup_version');
});
