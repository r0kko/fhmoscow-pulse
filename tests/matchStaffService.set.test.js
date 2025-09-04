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
  TeamStaff: { findAll: findTeamStaffMock },
  Staff: {},
  ClubStaff: {},
  StaffCategory: { findAll: findCatsMock },
  MatchStaff: {
    findAll: findMsMock,
    create: createMock,
  },
}));

jest.unstable_mockModule('../src/models/role.js', () => ({
  __esModule: true,
  default: {},
}));

const { default: service } = await import(
  '../src/services/matchStaffService.js'
);

function setupBase({ seasonId = 's1' } = {}) {
  findMatchMock.mockResolvedValue({
    id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    season_id: seasonId,
  });
  // Allow as ADMIN
  findUserMock.mockResolvedValue({ Roles: [{ alias: 'ADMIN' }], Teams: [] });
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
