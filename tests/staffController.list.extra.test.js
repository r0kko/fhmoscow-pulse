import { describe, expect, jest, test } from '@jest/globals';

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

function resMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('staffController.list extra branches', () => {
  test('(mine=true) forbidden when team_id not allowed', async () => {
    const req = {
      query: { mine: 'true', team_id: 'tX' },
      access: { isAdmin: false, allowedClubIds: ['c1'], allowedTeamIds: [] },
    };
    const res = resMock();
    await controller.list(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('parses pagination, search via q, and include flags', async () => {
    listStaffMock.mockClear();
    const req = {
      query: {
        page: '3',
        limit: '5',
        q: 'john',
        include: ['teams', 'clubs'],
      },
      access: { isAdmin: true },
    };
    const res = resMock();
    await controller.list(req, res);

    const arg = listStaffMock.mock.calls[0][0];
    expect(arg.page).toBe(3);
    expect(arg.limit).toBe(5);
    expect(arg.search).toBe('john');
    expect(arg.includeTeams).toBe(true);
    expect(arg.includeClubs).toBe(true);
  });
});
