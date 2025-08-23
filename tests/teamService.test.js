import { beforeEach, expect, jest, test } from '@jest/globals';
import { Op } from 'sequelize';

const extFindAllMock = jest.fn();
const teamCreateMock = jest.fn();
const teamUpdateMock = jest.fn();
const teamFindAllMock = jest.fn();
const userFindByPkMock = jest.fn();
const teamFindByPkMock = jest.fn();
const userAddTeamMock = jest.fn();
const userRemoveTeamMock = jest.fn();
const userTeamFindOneMock = jest.fn();
const userTeamUpdateMock = jest.fn();

beforeEach(() => {
  extFindAllMock.mockReset();
  teamCreateMock.mockReset();
  teamUpdateMock.mockReset();
  teamFindAllMock.mockReset();
  teamUpdateMock.mockResolvedValue([0]);
  teamFindAllMock.mockResolvedValue([]);
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

// Mock sequelize transaction to avoid real DB calls
const txMock = {};
const transactionMock = jest.fn(async (cb) => cb(txMock));
jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: transactionMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Team: {
    create: teamCreateMock,
    update: teamUpdateMock,
    findAll: teamFindAllMock,
    findByPk: teamFindByPkMock,
  },
  User: { findByPk: userFindByPkMock },
  UserTeam: { findOne: userTeamFindOneMock },
  Club: { findAll: jest.fn().mockResolvedValue([]) },
}));

const { default: service } = await import('../src/services/teamService.js');

test('syncExternal upserts active teams and soft deletes missing ones', async () => {
  extFindAllMock.mockResolvedValue([
    { id: 1, short_name: 'T1', year: 2005 },
  ]);
  await service.syncExternal('admin');
  // External fetch is invoked (active + archive); we don't assert exact where shape
  expect(extFindAllMock).toHaveBeenCalled();
  expect(teamCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      external_id: 1,
      name: 'T1',
      birth_year: 2005,
      created_by: 'admin',
      updated_by: 'admin',
      club_id: null,
    }),
    expect.objectContaining({ transaction: expect.any(Object) })
  );
  const calls = teamUpdateMock.mock.calls;
  const missingCall = calls.find((c) => c?.[1]?.where?.external_id?.[Op.notIn]);
  expect(missingCall).toBeTruthy();
  const whereArg = missingCall[1].where;
  expect(whereArg.external_id[Op.notIn]).toEqual([1]);
  expect(whereArg.external_id[Op.ne]).toBeNull();
  expect(missingCall[0]).toMatchObject({ updated_by: 'admin' });
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
