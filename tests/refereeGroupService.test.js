import { beforeEach, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const destroyMock = jest.fn();

beforeEach(() => {
  findOneMock.mockReset();
  destroyMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  RefereeGroup: {},
  RefereeGroupUser: { findOne: findOneMock },
  Season: {},
  User: {},
  Role: {},
}));

const { default: service } = await import('../src/services/refereeGroupService.js');

test('removeUser deletes assignment permanently', async () => {
  findOneMock.mockResolvedValue({ destroy: destroyMock });
  await service.removeUser('u1');
  expect(destroyMock).toHaveBeenCalledWith({ force: true });
});


test('removeUser does nothing when link missing', async () => {
  findOneMock.mockResolvedValue(null);
  await service.removeUser('u1');
  expect(destroyMock).not.toHaveBeenCalled();
});
