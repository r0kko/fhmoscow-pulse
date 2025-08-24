import { describe, expect, jest, test } from '@jest/globals';

const listStaffMock = jest.fn().mockResolvedValue({ rows: [], count: 0 });

jest.unstable_mockModule('../src/services/staffService.js', () => ({
  __esModule: true,
  default: { list: listStaffMock },
}));
jest.unstable_mockModule('../src/services/clubService.js', () => ({
  __esModule: true,
  default: { list: jest.fn() },
}));
jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: { listUserTeams: jest.fn() },
}));
jest.unstable_mockModule('../src/mappers/staffMapper.js', () => ({
  __esModule: true,
  default: { toPublicArray: (rows) => rows },
}));

const { default: controller } = await import('../src/controllers/staffController.js');

function resMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('staffController access', () => {
  test('forbidden when staff has no allowed scope', async () => {
    const req = {
      query: {},
      access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
    };
    const res = resMock();
    await controller.list(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('(mine=true) includes allowed clubIds/teamIds', async () => {
    listStaffMock.mockClear();
    const req = {
      query: { mine: 'true' },
      access: {
        isAdmin: false,
        allowedClubIds: ['c1'],
        allowedTeamIds: ['t1'],
      },
    };
    const res = resMock();
    await controller.list(req, res);
    const arg = listStaffMock.mock.calls[0][0];
    expect(arg.clubIds).toEqual(['c1']);
  });

  test('forbidden when staff club_id not in scope', async () => {
    const req = {
      query: { club_id: 'cx' },
      access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
    };
    const res = resMock();
    await controller.list(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('forbidden when staff team_id not in scope', async () => {
    const req = {
      query: { team_id: 'tx' },
      access: { isAdmin: false, allowedClubIds: ['c1'], allowedTeamIds: [] },
    };
    const res = resMock();
    await controller.list(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('admin without mine=true uses full list', async () => {
    listStaffMock.mockClear();
    const req = { query: {}, access: { isAdmin: true } };
    const res = resMock();
    await controller.list(req, res);
    expect(listStaffMock).toHaveBeenCalled();
  });
});
