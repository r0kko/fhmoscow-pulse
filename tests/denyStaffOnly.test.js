import { describe, expect, jest, test } from '@jest/globals';

const nextMock = jest.fn();

describe('denyStaffOnly middleware', () => {
  test('blocks users with only SPORT_SCHOOL_STAFF', async () => {
    const roles = [{ alias: 'SPORT_SCHOOL_STAFF' }];
    const req = { user: { getRoles: jest.fn().mockResolvedValue(roles) } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    nextMock.mockReset();
    const { default: denyStaffOnly } =
      await import('../src/middlewares/denyStaffOnly.js');
    await denyStaffOnly(req, res, nextMock);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Доступ ограничен для сотрудников СШ',
    });
    expect(nextMock).not.toHaveBeenCalled();
  });

  test('allows admins or users with other roles', async () => {
    const roles = [{ alias: 'SPORT_SCHOOL_STAFF' }, { alias: 'ADMIN' }];
    const req = { user: { getRoles: jest.fn().mockResolvedValue(roles) } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    nextMock.mockReset();
    const { default: denyStaffOnly } =
      await import('../src/middlewares/denyStaffOnly.js');
    await denyStaffOnly(req, res, nextMock);
    expect(nextMock).toHaveBeenCalled();
  });

  test('returns 401 when not authenticated', async () => {
    const req = { user: null };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    nextMock.mockReset();
    const { default: denyStaffOnly } =
      await import('../src/middlewares/denyStaffOnly.js');
    await denyStaffOnly(req, res, nextMock);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(nextMock).not.toHaveBeenCalled();
  });
});
