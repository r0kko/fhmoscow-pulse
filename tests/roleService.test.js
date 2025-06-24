import { expect, jest, test } from '@jest/globals';

const findAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Role: { findAll: findAllMock },
}));

const { default: service } = await import('../src/services/roleService.js');

test('listRoles returns all roles', async () => {
  findAllMock.mockResolvedValue([{ id: '1' }]);
  const res = await service.listRoles();
  expect(findAllMock).toHaveBeenCalled();
  expect(res).toEqual([{ id: '1' }]);
});
