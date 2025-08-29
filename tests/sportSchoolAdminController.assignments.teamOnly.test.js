import { expect, jest, test, beforeEach } from '@jest/globals';

// Mocks
const teamServiceListMock = jest.fn();
const listUsersForTeamsMock = jest.fn();
jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: { list: teamServiceListMock },
  listUsersForTeams: listUsersForTeamsMock,
}));

const clubMapperToPublicMock = jest.fn((c) => c && { id: c.id, name: c.name });
jest.unstable_mockModule('../src/mappers/clubMapper.js', () => ({
  __esModule: true,
  default: { toPublic: clubMapperToPublicMock },
}));

const teamMapperToPublicMock = jest.fn((t) => ({ id: t.id, name: t.name }));
jest.unstable_mockModule('../src/mappers/teamMapper.js', () => ({
  __esModule: true,
  default: { toPublic: teamMapperToPublicMock },
}));

const userMapperToPublicArrayMock = jest.fn((arr) => arr);
jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublicArray: userMapperToPublicArrayMock },
}));

// listClubUsers should be ignored by controller after fix, but we keep a mock to ensure it would not affect users
const listClubUsersMock = jest.fn();
jest.unstable_mockModule('../src/services/clubUserService.js', () => ({
  __esModule: true,
  listClubUsers: listClubUsersMock,
  default: { listUserClubs: jest.fn() },
}));

const { default: controller } = await import(
  '../src/controllers/sportSchoolAdminController.js'
);

beforeEach(() => {
  teamServiceListMock.mockReset();
  listUsersForTeamsMock.mockReset();
  listClubUsersMock.mockReset();
});

test('listAssignments returns only team-assigned users (no club-only users)', async () => {
  // Arrange: two teams under the same club
  const club = { id: 'club1', name: 'Club' };
  const team1 = { id: 't1', name: 'Team 1', Club: club };
  const team2 = { id: 't2', name: 'Team 2', Club: club };
  teamServiceListMock.mockResolvedValue({ rows: [team1, team2] });

  // Club-only user should not appear in team list
  listClubUsersMock.mockResolvedValue([{ id: 'uClub' }]);

  // Team users per team (batched)
  listUsersForTeamsMock.mockResolvedValue(
    new Map([
      ['t1', [{ id: 'u1' }]],
      ['t2', []],
    ])
  );

  const req = { query: { page: '1', limit: '10' } };
  const json = jest.fn();
  const res = { json };

  // Act
  await controller.listAssignments(req, res);

  // Assert
  const payload = json.mock.calls[0][0];
  expect(Array.isArray(payload.items)).toBe(true);
  // Team 1 has only u1, Team 2 has none; club-only user is not included
  const team1Row = payload.items.find((r) => r.team.id === 't1');
  const team2Row = payload.items.find((r) => r.team.id === 't2');
  expect(team1Row.users).toEqual([{ id: 'u1' }]);
  expect(team2Row.users).toEqual([]);
});

test('listAssignments applies search and has_staff filters', async () => {
  const club = { id: 'club2', name: 'Alpha Club' };
  const team1 = { id: 'tt1', name: 'Alpha Team', Club: club, birth_year: 2005 };
  const team2 = { id: 'tt2', name: 'Beta Team', Club: club, birth_year: 2006 };
  teamServiceListMock.mockResolvedValue({ rows: [team1, team2] });
  listUsersForTeamsMock.mockResolvedValue(
    new Map([
      ['tt1', [{ id: 'uA' }]],
      ['tt2', []],
    ])
  );
  const json = jest.fn();
  const res = { json };
  await controller.listAssignments(
    { query: { page: '1', limit: '10', search: 'alpha', has_staff: 'true' } },
    res
  );
  const payload = json.mock.calls[0][0];
  // Only Alpha Team remains after search, and has_staff filters out empty team
  expect(payload.items.length).toBe(1);
  expect(payload.items[0].team.id).toBe('tt1');
});
