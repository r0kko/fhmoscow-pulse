import { describe, expect, jest, test } from '@jest/globals';

const listClubsMock = jest.fn();
const syncExternalMock = jest.fn();

let externalAvailable = true;

jest.unstable_mockModule('../src/services/clubService.js', () => ({
  __esModule: true,
  default: { list: listClubsMock, syncExternal: syncExternalMock },
}));
jest.unstable_mockModule('../src/mappers/clubMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (c) => c },
}));
jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  isExternalDbAvailable: () => externalAvailable,
}));

const { default: controller } = await import(
  '../src/controllers/clubController.js'
);

function resMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('clubController.sync', () => {
  test('returns 503 when external DB unavailable', async () => {
    externalAvailable = false;
    const req = { user: { id: 'u1' } };
    const res = resMock();
    await controller.sync(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'external_unavailable' });
    externalAvailable = true;
  });

  test('syncs and returns latest list', async () => {
    syncExternalMock.mockResolvedValue({ created: 1, updated: 2 });
    listClubsMock.mockResolvedValue({ rows: [{ id: 'c1' }], count: 1 });
    const req = { user: { id: 'uX' } };
    const res = resMock();
    await controller.sync(req, res);
    expect(syncExternalMock).toHaveBeenCalledWith('uX');
    expect(listClubsMock).toHaveBeenCalledWith({ page: 1, limit: 100 });
    expect(res.json).toHaveBeenCalledWith({
      stats: { created: 1, updated: 2 },
      clubs: [{ id: 'c1' }],
      total: 1,
    });
  });
});

describe('clubController.list include flags', () => {
  test('include=teams,grounds maps to include flags', async () => {
    listClubsMock.mockResolvedValueOnce({ rows: [], count: 0 });
    const req = {
      query: { include: ['teams', 'grounds'] },
      access: { isAdmin: true },
    };
    const res = resMock();
    await controller.list(req, res);
    const call = listClubsMock.mock.calls[0][0];
    expect(call.includeTeams).toBe(true);
    expect(call.includeGrounds).toBe(true);
  });
});
