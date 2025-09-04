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

const { default: controller } = await import(
  '../src/controllers/staffController.js'
);

test('include=teams and include=clubs map correctly', async () => {
  listStaffMock.mockClear();
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

  // include=teams
  await controller.list(
    { query: { include: 'teams' }, access: { isAdmin: true } },
    res
  );
  let call = listStaffMock.mock.calls[0][0];
  expect(call.includeTeams).toBe(true);
  expect(call.includeClubs).toBe(false);

  // include=clubs
  listStaffMock.mockClear();
  await controller.list(
    { query: { include: 'clubs' }, access: { isAdmin: true } },
    res
  );
  call = listStaffMock.mock.calls[0][0];
  expect(call.includeTeams).toBe(false);
  expect(call.includeClubs).toBe(true);
});
