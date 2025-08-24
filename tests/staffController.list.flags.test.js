import { expect, jest, test } from '@jest/globals';

const listStaffMock = jest.fn().mockResolvedValue({ rows: [], count: 0 });

jest.unstable_mockModule('../src/services/staffService.js', () => ({
  __esModule: true,
  default: { list: listStaffMock },
}));
jest.unstable_mockModule('../src/mappers/staffMapper.js', () => ({
  __esModule: true,
  default: { toPublicArray: (rows) => rows },
}));

const { default: controller } = await import('../src/controllers/staffController.js');

test('withTeams/withClubs flags map to include flags', async () => {
  listStaffMock.mockClear();
  const req = {
    query: { withTeams: 'true', withClubs: 'true' },
    access: { isAdmin: true },
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.list(req, res);
  const call = listStaffMock.mock.calls[0][0];
  expect(call.includeTeams).toBe(true);
  expect(call.includeClubs).toBe(true);
});

