import { beforeEach, expect, jest, test } from '@jest/globals';

const tx = { id: 'tx' };
const createMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();
const restoreMock = jest.fn();
const findMsMock = jest.fn();
const findTeamStaffMock = jest.fn();
const findCatsMock = jest.fn();
const findMatchMock = jest.fn();
const findUserMock = jest.fn();
const findTeamMock = jest.fn();

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  destroyMock.mockReset();
  restoreMock.mockReset();
  findMsMock.mockReset();
  findTeamStaffMock.mockReset();
  findCatsMock.mockReset();
  findMatchMock.mockReset();
  findUserMock.mockReset();
  findTeamMock.mockReset();
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: (fn) => fn(tx) },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: findMatchMock },
  Team: { findAll: findTeamMock },
  User: { findByPk: findUserMock },
  Role: {},
  UserClub: {},
  SportSchoolPosition: {},
  TeamStaff: { findAll: findTeamStaffMock },
  Staff: {},
  ClubStaff: {},
  StaffCategory: { findAll: findCatsMock },
  MatchStaff: {
    findAll: findMsMock,
    create: createMock,
  },
  Tournament: {},
  TournamentType: {},
  ScheduleManagementType: {},
}));

const { default: service } =
  await import('../src/services/matchStaffService.js');

function setupBase({ seasonId = 's1' } = {}) {
  findMatchMock.mockResolvedValue({
    id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    season_id: seasonId,
  });
  // Allow as ADMIN
  findUserMock.mockResolvedValue({
    Roles: [{ alias: 'ADMIN' }],
    Teams: [],
    UserClubs: [],
  });
  findTeamMock.mockResolvedValue([]);
  // Team staff exists for both ids
  findTeamStaffMock.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
  // Categories include head coach and coach
  findCatsMock.mockResolvedValue([
    { id: 'hc', name: 'Главный тренер' },
    { id: 'coach', name: 'Тренер' },
  ]);
}

test('set creates rows only for selected staff', async () => {
  setupBase();
  // No existing
  findMsMock.mockResolvedValue([]);
  await service.set(
    'm1',
    't1',
    null,
    [
      { team_staff_id: 'a', selected: true, role_id: 'coach' },
      { team_staff_id: 'b', selected: false, role_id: null },
    ],
    'admin'
  );
  expect(createMock).toHaveBeenCalledTimes(1);
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({
      team_staff_id: 'a',
      team_id: 't1',
      match_id: 'm1',
      role_id: 'coach',
    }),
    expect.any(Object)
  );
});

test('set removes unselected and adds newly selected', async () => {
  setupBase();
  // First call: select a
  findMsMock.mockResolvedValue([]);
  await service.set(
    'm1',
    't1',
    null,
    [{ team_staff_id: 'a', selected: true, role_id: 'coach' }],
    'admin'
  );
  // Second call: selected becomes b, existing contains a
  findMsMock.mockResolvedValue([
    {
      id: 'ms-a',
      team_staff_id: 'a',
      team_id: 't1',
      update: updateMock,
      destroy: destroyMock,
      restore: restoreMock,
    },
  ]);
  await service.set(
    'm1',
    't1',
    null,
    [{ team_staff_id: 'b', selected: true, role_id: 'coach' }],
    'admin'
  );
  // Should create b and destroy a
  expect(createMock).toHaveBeenCalledWith(
    expect.objectContaining({ team_staff_id: 'b' }),
    expect.any(Object)
  );
  expect(destroyMock).toHaveBeenCalled();
});

test('list allows club-wide staff without team link', async () => {
  findMatchMock.mockResolvedValue({
    id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    season_id: 's1',
    Tournament: { TournamentType: { double_protocol: false } },
  });
  findUserMock.mockResolvedValue({
    Teams: [],
    Roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
    UserClubs: [
      {
        club_id: 'c1',
        SportSchoolPosition: { alias: 'DIRECTOR' },
      },
    ],
  });
  findTeamMock.mockResolvedValue([
    { id: 't1', club_id: 'c1' },
    { id: 't2', club_id: 'c2' },
  ]);
  findTeamStaffMock.mockResolvedValue([]);
  findMsMock.mockResolvedValue([]);
  findCatsMock.mockResolvedValue([]);

  const res = await service.list('m1', 'u1');
  expect(res).toMatchObject({
    match_id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    is_admin: false,
  });
  expect(Array.isArray(res.home.staff)).toBe(true);
  expect(Array.isArray(res.away.staff)).toBe(true);
});

test('set rejects when more than one head coach selected', async () => {
  setupBase();
  findMsMock.mockResolvedValue([]);
  await expect(
    service.set(
      'm1',
      't1',
      null,
      [
        { team_staff_id: 'a', selected: true, role_id: 'hc' },
        { team_staff_id: 'b', selected: true, role_id: 'hc' },
      ],
      'admin'
    )
  ).rejects.toThrow('too_many_head_coaches');
});

test('set rejects invalid staff ids with details', async () => {
  setupBase();
  findMsMock.mockResolvedValue([]);
  findTeamStaffMock.mockResolvedValue([{ id: 'a' }]);
  await expect(
    service.set(
      'm1',
      't1',
      null,
      [
        { team_staff_id: 'a', selected: true, role_id: 'coach' },
        { team_staff_id: 'b', selected: true, role_id: 'coach' },
      ],
      'admin'
    )
  ).rejects.toMatchObject({
    message: 'staff_not_in_team',
    details: { invalid_staff_ids: ['b'] },
  });
});
