import { describe, expect, jest, test } from '@jest/globals';

const listClubsMock = jest.fn().mockResolvedValue({ rows: [], count: 0 });
const listUserClubsMock = jest
  .fn()
  .mockResolvedValue([{ id: 'c1', name: 'A' }]);

jest.unstable_mockModule('../src/services/clubService.js', () => ({
  __esModule: true,
  default: { list: listClubsMock },
}));
jest.unstable_mockModule('../src/services/clubUserService.js', () => ({
  __esModule: true,
  default: { listUserClubs: listUserClubsMock },
}));
jest.unstable_mockModule('../src/mappers/clubMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (c) => ({ id: c.id, name: c.name }) },
}));

const { default: controller } =
  await import('../src/controllers/clubController.js');

function resMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('clubController access', () => {
  test('staff with mine=true gets only personal clubs', async () => {
    const req = {
      query: { mine: 'true' },
      user: { id: 'u1' },
      access: { isAdmin: false },
    };
    const res = resMock();
    await controller.list(req, res);
    expect(listUserClubsMock).toHaveBeenCalledWith('u1', false);
    const payload = res.json.mock.calls[0][0];
    expect(payload.clubs).toEqual([{ id: 'c1', name: 'A' }]);
    expect(payload.total).toBe(1);
  });

  test('mine=true respects search filtering', async () => {
    listUserClubsMock.mockResolvedValueOnce([
      { id: 'c1', name: 'Moscow' },
      { id: 'c2', name: 'Spartak' },
    ]);
    const req = {
      query: { mine: 'true', search: 'sp' },
      user: { id: 'u1' },
      access: { isAdmin: false },
    };
    const res = resMock();
    await controller.list(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.clubs.length).toBe(1);
  });

  test('staff without mine=true is forbidden', async () => {
    const req = { query: {}, access: { isAdmin: false } };
    const res = resMock();
    await controller.list(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('admin without mine=true uses full list', async () => {
    const req = { query: {}, access: { isAdmin: true } };
    const res = resMock();
    await controller.list(req, res);
    expect(listClubsMock).toHaveBeenCalled();
  });
});
