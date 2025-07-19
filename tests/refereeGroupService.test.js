import { beforeEach, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const destroyMock = jest.fn();
const createMock = jest.fn();
const restoreMock = jest.fn();
const updateMock = jest.fn();
const findGroupMock = jest.fn();
const findUserMock = jest.fn();
const findAndCountAllMock = jest.fn();
const countMock = jest.fn();
const createGroupMock = jest.fn();
const getActiveMock = jest.fn();

beforeEach(() => {
  findOneMock.mockReset();
  destroyMock.mockReset();
  createMock.mockReset();
  restoreMock.mockReset();
  updateMock.mockReset();
  findGroupMock.mockReset();
  findUserMock.mockReset();
  findAndCountAllMock.mockReset();
  countMock.mockReset();
  createGroupMock.mockReset();
  getActiveMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  RefereeGroup: {
    findByPk: findGroupMock,
    findAndCountAll: findAndCountAllMock,
    create: createGroupMock,
  },
  RefereeGroupUser: {
    findOne: findOneMock,
    create: createMock,
    count: countMock,
  },
  Season: {},
  User: { findByPk: findUserMock, findAll: jest.fn() },
  Role: {},
  Training: {},
  TrainingRegistration: {},
}));

jest.unstable_mockModule('../src/services/seasonService.js', () => ({
  __esModule: true,
  default: { getActive: getActiveMock },
}));

const { default: service } = await import('../src/services/refereeGroupService.js');

test('removeUser soft deletes assignment', async () => {
  findOneMock.mockResolvedValue({ destroy: destroyMock, update: updateMock });
  await service.removeUser('u1', 'admin');
  expect(updateMock).toHaveBeenCalledWith({ updated_by: 'admin' });
  expect(destroyMock).toHaveBeenCalled();
});

test('removeUser does nothing when link missing', async () => {
  findOneMock.mockResolvedValue(null);
  await service.removeUser('u1', 'admin');
  expect(destroyMock).not.toHaveBeenCalled();
});

test('setUserGroup restores deleted record', async () => {
  findGroupMock.mockResolvedValue({ id: 'g1' });
  findUserMock.mockResolvedValue({ id: 'u1' });
  findOneMock.mockResolvedValue({ deletedAt: new Date(), restore: restoreMock, update: updateMock });
  await service.setUserGroup('u1', 'g1', 'admin');
  expect(restoreMock).toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith({ group_id: 'g1', updated_by: 'admin' });
  expect(createMock).not.toHaveBeenCalled();
});

test('user can be reassigned after removal', async () => {
  // soft delete existing assignment
  findOneMock.mockResolvedValueOnce({ destroy: destroyMock, update: updateMock });
  await service.removeUser('u1', 'admin');
  expect(destroyMock).toHaveBeenCalled();

  // assign user to a group again
  findGroupMock.mockResolvedValue({ id: 'g2' });
  findUserMock.mockResolvedValue({ id: 'u1' });
  findOneMock.mockResolvedValueOnce({ deletedAt: new Date(), restore: restoreMock, update: updateMock });
  await service.setUserGroup('u1', 'g2', 'admin');
  expect(restoreMock).toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith({ group_id: 'g2', updated_by: 'admin' });
  expect(createMock).not.toHaveBeenCalled();
});

test('listAll applies active season', async () => {
  getActiveMock.mockResolvedValue({ id: 's1' });
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  const res = await service.listAll({ page: 2, limit: 5 });
  const arg = findAndCountAllMock.mock.calls[0][0];
  expect(arg.where.season_id).toBe('s1');
  expect(arg.limit).toBe(5);
  expect(arg.offset).toBe(5);
  expect(res).toEqual({ rows: [], count: 0 });
});

test('getById throws when inactive', async () => {
  findGroupMock.mockResolvedValue({ Season: { active: false } });
  await expect(service.getById('g1')).rejects.toThrow('referee_group_not_found');
});

test('create returns new group', async () => {
  createGroupMock.mockResolvedValue({ id: 'g3' });
  const res = await service.create({ season_id: 's', name: 'G' }, 'adm');
  expect(createGroupMock).toHaveBeenCalledWith({
    season_id: 's',
    name: 'G',
    created_by: 'adm',
    updated_by: 'adm',
  });
  expect(res).toEqual({ id: 'g3' });
});

test('remove rejects when group not empty', async () => {
  findGroupMock.mockResolvedValue({});
  countMock.mockResolvedValue(1);
  await expect(service.remove('g1')).rejects.toThrow('referee_group_not_empty');
});

test('remove deletes empty group', async () => {
  findGroupMock.mockResolvedValue({ update: updateMock, destroy: destroyMock });
  countMock.mockResolvedValue(0);
  await service.remove('g1', 'adm');
  expect(updateMock).toHaveBeenCalledWith({ updated_by: 'adm' });
  expect(destroyMock).toHaveBeenCalled();
});
