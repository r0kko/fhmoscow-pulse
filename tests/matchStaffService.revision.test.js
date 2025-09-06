import { beforeEach, expect, jest, test } from '@jest/globals';

const tx = { id: 'tx' };

const findMatchMock = jest.fn();
const findUserMock = jest.fn();
const findMsMock = jest.fn();

beforeEach(() => {
  findMatchMock.mockReset();
  findUserMock.mockReset();
  findMsMock.mockReset();
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: (fn) => fn(tx) },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: findMatchMock },
  Team: {},
  User: { findByPk: findUserMock },
  TeamStaff: { findAll: jest.fn().mockResolvedValue([]) },
  Staff: {},
  ClubStaff: {},
  StaffCategory: { findAll: jest.fn().mockResolvedValue([]) },
  MatchStaff: { findAll: findMsMock },
  Tournament: {},
  TournamentType: {},
}));

jest.unstable_mockModule('../src/models/role.js', () => ({
  __esModule: true,
  default: {},
}));

const { default: service } = await import(
  '../src/services/matchStaffService.js'
);

function baseMatch() {
  return {
    id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    season_id: 's1',
    Tournament: { TournamentType: { double_protocol: false } },
  };
}

test('set throws conflict on mismatched if_staff_rev', async () => {
  findMatchMock.mockResolvedValue(baseMatch());
  // ADMIN
  findUserMock.mockResolvedValue({ Teams: [], Roles: [{ alias: 'ADMIN' }] });
  findMsMock.mockResolvedValue([
    { id: 'ms1', team_staff_id: 'a', team_id: 't1', role_id: 'coach' },
  ]);
  await expect(
    service.set('m1', 't1', null, [], 'admin', 'rev-mismatch')
  ).rejects.toThrow('conflict_staff_version');
});
