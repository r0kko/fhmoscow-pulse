import { beforeEach, expect, jest, test } from '@jest/globals';

const extFindAllMock = jest.fn();
const teamUpsertMock = jest.fn();
const userFindByPkMock = jest.fn();
const teamFindByPkMock = jest.fn();
const userTeamCreateMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  teamUpsertMock.mockReset();
  userFindByPkMock.mockReset();
  teamFindByPkMock.mockReset();
  userTeamCreateMock.mockReset();
});

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Team: { findAll: extFindAllMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Team: { upsert: teamUpsertMock, findByPk: teamFindByPkMock },
  User: { findByPk: userFindByPkMock },
  UserTeam: { create: userTeamCreateMock },
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

test('addUserTeam creates link with audit fields', async () => {
  userFindByPkMock.mockResolvedValue({ id: 'u1' });
  teamFindByPkMock.mockResolvedValue({ id: 't1' });
  await service.addUserTeam('u1', 't1', 'actor');
  expect(userTeamCreateMock).toHaveBeenCalledWith({
    user_id: 'u1',
    team_id: 't1',
    created_by: 'actor',
    updated_by: 'actor',
  });
});
