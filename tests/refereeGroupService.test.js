import { beforeEach, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const destroyMock = jest.fn();
const createMock = jest.fn();
const restoreMock = jest.fn();
const updateMock = jest.fn();
const findGroupMock = jest.fn();
const findUserMock = jest.fn();

beforeEach(() => {
  findOneMock.mockReset();
  destroyMock.mockReset();
  createMock.mockReset();
  restoreMock.mockReset();
  updateMock.mockReset();
  findGroupMock.mockReset();
  findUserMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  RefereeGroup: { findByPk: findGroupMock },
  RefereeGroupUser: { findOne: findOneMock, create: createMock },
  Season: {},
  User: { findByPk: findUserMock },
  Role: {},
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
