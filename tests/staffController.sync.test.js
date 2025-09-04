import { describe, expect, jest, test } from '@jest/globals';

// Mocks
const staffListMock = jest.fn();
const staffSyncMock = jest.fn();
const clubSyncMock = jest.fn();
const teamSyncMock = jest.fn();
const toPublicArrayMock = jest.fn((rows) => rows);

let externalAvailable = true;

jest.unstable_mockModule('../src/services/staffService.js', () => ({
  __esModule: true,
  default: { list: staffListMock, syncExternal: staffSyncMock },
}));
jest.unstable_mockModule('../src/services/clubService.js', () => ({
  __esModule: true,
  default: { syncExternal: clubSyncMock },
}));
jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: { syncExternal: teamSyncMock },
}));
jest.unstable_mockModule('../src/mappers/staffMapper.js', () => ({
  __esModule: true,
  default: { toPublicArray: toPublicArrayMock },
}));
jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  isExternalDbAvailable: () => externalAvailable,
}));

const { default: controller } = await import(
  '../src/controllers/staffController.js'
);

function resMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

describe('staffController.sync', () => {
  test('returns 503 when external DB unavailable', async () => {
    externalAvailable = false;
    const req = { user: { id: 'u1' } };
    const res = resMock();
    await controller.sync(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'external_unavailable' });
    externalAvailable = true;
  });

  test('syncs clubs, teams, staff and returns list', async () => {
    staffListMock.mockResolvedValue({ rows: [{ id: 's1' }], count: 1 });
    staffSyncMock.mockResolvedValue({ created: 2, updated: 3 });
    clubSyncMock.mockResolvedValue({ created: 1, updated: 0 });
    teamSyncMock.mockResolvedValue({ created: 5 });

    const req = { user: { id: 'u1' } };
    const res = resMock();
    await controller.sync(req, res);

    expect(clubSyncMock).toHaveBeenCalledWith('u1');
    expect(teamSyncMock).toHaveBeenCalledWith('u1');
    expect(staffSyncMock).toHaveBeenCalledWith('u1');
    expect(staffListMock).toHaveBeenCalledWith({ page: 1, limit: 100 });
    expect(toPublicArrayMock).toHaveBeenCalledWith([{ id: 's1' }]);
    expect(res.json).toHaveBeenCalledWith({
      stats: {
        clubs: { created: 1, updated: 0 },
        teams: { created: 5 },
        created: 2,
        updated: 3,
      },
      staff: [{ id: 's1' }],
      total: 1,
    });
  });
});
