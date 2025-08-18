import { beforeEach, expect, jest, test } from '@jest/globals';

const extFindAllMock = jest.fn();
const teamUpsertMock = jest.fn();
const userFindByPkMock = jest.fn();
const teamFindByPkMock = jest.fn();
const userAddTeamMock = jest.fn();
const userRemoveTeamMock = jest.fn();
const userTeamFindOneMock = jest.fn();
const userTeamUpdateMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  teamUpsertMock.mockReset();
  userFindByPkMock.mockReset();
  teamFindByPkMock.mockReset();
  userAddTeamMock.mockReset();
  userRemoveTeamMock.mockReset();
  userTeamFindOneMock.mockReset();
  userTeamUpdateMock.mockReset();
});

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Team: { findAll: extFindAllMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Team: { upsert: teamUpsertMock, findByPk: teamFindByPkMock },
  User: { findByPk: userFindByPkMock },
  UserTeam: { findOne: userTeamFindOneMock },
}));

const { default: service } = await import('../src/services/teamService.js');

test('syncExternal upserts teams', async () => {
  extFindAllMock.mockResolvedValue([{ id: 1, full_name: 'Team1', short_name: 'T1' }]);
  await service.syncExternal('admin');
  expect(teamUpsertMock).toHaveBeenCalledWith({
    external_id: 1,
    full_name: 'Team1',
    short_name: 'T1',
    created_by: 'admin',
    updated_by: 'admin',
  });
});

test('addUserTeam uses association with audit fields', async () => {
  userFindByPkMock.mockResolvedValue({ id: 'u1', addTeam: userAddTeamMock });
  teamFindByPkMock.mockResolvedValue({ id: 't1' });
  await service.addUserTeam('u1', 't1', 'actor');
  expect(userAddTeamMock).toHaveBeenCalledWith(
    { id: 't1' },
    { through: { created_by: 'actor', updated_by: 'actor' } }
  );
});

test('removeUserTeam updates audit and removes link', async () => {
  userFindByPkMock.mockResolvedValue({ id: 'u1', removeTeam: userRemoveTeamMock });
  teamFindByPkMock.mockResolvedValue({ id: 't1' });
  userTeamFindOneMock.mockResolvedValue({ update: userTeamUpdateMock });
  await service.removeUserTeam('u1', 't1', 'actor');
  expect(userTeamUpdateMock).toHaveBeenCalledWith({ updated_by: 'actor' });
  expect(userRemoveTeamMock).toHaveBeenCalledWith({ id: 't1' });
});
