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
const runWithSyncStateMock = jest.fn(async (job, runner) => {
  const outcome = await runner({ mode: 'incremental', since: null });
  return {
    mode: 'incremental',
    cursor: outcome.cursor,
    outcome,
    state: { job },
  };
});
jest.unstable_mockModule('../src/services/syncStateService.js', () => ({
  __esModule: true,
  runWithSyncState: (...args) => runWithSyncStateMock(...args),
}));

const { default: controller } = await import(
  '../src/controllers/staffController.js'
);

function resMock() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => {
  runWithSyncStateMock.mockReset().mockImplementation(async (job, runner) => {
    const outcome = await runner({ mode: 'incremental', since: null });
    return {
      mode: 'incremental',
      cursor: outcome.cursor,
      outcome,
      state: { job },
    };
  });
});

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

    expect(clubSyncMock).toHaveBeenCalledWith({
      actorId: 'u1',
      mode: 'incremental',
      since: null,
    });
    expect(teamSyncMock).toHaveBeenCalledWith({
      actorId: 'u1',
      mode: 'incremental',
      since: null,
    });
    expect(staffSyncMock).toHaveBeenCalledWith({
      actorId: 'u1',
      mode: 'incremental',
      since: null,
    });
    expect(staffListMock).toHaveBeenCalledWith({ page: 1, limit: 100 });
    expect(toPublicArrayMock).toHaveBeenCalledWith([{ id: 's1' }]);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: expect.objectContaining({
          clubs: { created: 1, updated: 0 },
          teams: { created: 5 },
          staff: { created: 2, updated: 3 },
        }),
        staff: [{ id: 's1' }],
        total: 1,
        modes: expect.objectContaining({ staff: 'incremental' }),
      })
    );
  });
});
