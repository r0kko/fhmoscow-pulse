import { describe, expect, jest, test } from '@jest/globals';

const listUserClubsMock = jest.fn();
const listUserTeamsMock = jest.fn();

jest.unstable_mockModule('../src/services/clubUserService.js', () => ({
  __esModule: true,
  default: { listUserClubs: listUserClubsMock },
}));
jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: {
    listUserTeams: listUserTeamsMock,
  },
}));

describe('accessScope middleware', () => {
  test('attaches allowed clubs/teams for staff', async () => {
    listUserClubsMock.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    listUserTeamsMock.mockResolvedValue([{ id: 't1' }]);
    const roles = [{ alias: 'SPORT_SCHOOL_STAFF' }];
    const req = {
      user: { getRoles: jest.fn().mockResolvedValue(roles), id: 'u1' },
    };
    const res = {};
    const next = jest.fn();
    const { default: accessScope } = await import(
      '../src/middlewares/accessScope.js'
    );
    await accessScope(req, res, next);
    expect(req.access).toMatchObject({
      isAdmin: false,
      isStaff: true,
      allowedClubIds: ['c1', 'c2'],
      allowedTeamIds: ['t1'],
    });
    expect(next).toHaveBeenCalled();
  });

  test('admin without staff has empty allowed lists but isAdmin=true', async () => {
    listUserClubsMock.mockResolvedValue([]);
    listUserTeamsMock.mockResolvedValue([]);
    const roles = [{ alias: 'ADMIN' }];
    const req = {
      user: { getRoles: jest.fn().mockResolvedValue(roles), id: 'u1' },
    };
    const res = {};
    const next = jest.fn();
    const { default: accessScope } = await import(
      '../src/middlewares/accessScope.js'
    );
    await accessScope(req, res, next);
    expect(req.access.isAdmin).toBe(true);
    expect(req.access.allowedClubIds).toEqual([]);
    expect(req.access.allowedTeamIds).toEqual([]);
  });

  test('returns 401 when user missing', async () => {
    const req = { user: null };
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const res = { status, json };
    const next = jest.fn();
    const { default: accessScope } = await import(
      '../src/middlewares/accessScope.js'
    );
    await accessScope(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Не авторизовано' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 500 on unexpected error', async () => {
    const req = {
      user: {
        getRoles: jest.fn(() => {
          throw new Error('x');
        }),
      },
    };
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const res = { status, json };
    const next = jest.fn();
    const { default: accessScope } = await import(
      '../src/middlewares/accessScope.js'
    );
    await accessScope(req, res, next);
    expect(status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
