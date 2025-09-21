import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const findAllMock = jest.fn();
const upsertMock = jest.fn();

jest.unstable_mockModule('../src/models/syncState.js', () => ({
  __esModule: true,
  default: {
    findOne: findOneMock,
    findAll: findAllMock,
    upsert: upsertMock,
  },
}));

const svc = await import('../src/services/syncStateService.js');

beforeEach(() => {
  findOneMock.mockReset();
  findAllMock.mockReset();
  upsertMock.mockReset();
});

describe('runWithSyncState', () => {
  test('defaults to full run when no prior state', async () => {
    findOneMock.mockResolvedValue(null);
    upsertMock.mockResolvedValue(null);

    const cursor = new Date('2024-01-02T12:00:00Z');
    const result = await svc.runWithSyncState('clubSync', async (ctx) => {
      expect(ctx.mode).toBe('full');
      expect(ctx.since).toBeNull();
      return {
        cursor,
        stats: { upserts: 5, deleted: 1 },
      };
    });

    expect(result.cursor?.toISOString()).toBe(cursor.toISOString());
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload.job).toBe('clubSync');
    expect(payload.last_mode).toBe('full');
    expect(payload.last_cursor instanceof Date).toBe(true);
    expect(payload.last_full_sync_at instanceof Date).toBe(true);
    expect(payload.meta?.last_stats).toEqual({ upserts: 5, deleted: 1 });
  });

  test('uses incremental mode when full run is not due', async () => {
    const lastFull = new Date(Date.now() - 60 * 60 * 1000);
    const lastCursor = new Date('2024-01-03T00:00:00Z');
    findOneMock.mockResolvedValue({
      job: 'playerSync',
      last_full_sync_at: lastFull,
      last_cursor: lastCursor,
      meta: { last_stats: { upserts: 10 } },
    });
    upsertMock.mockResolvedValue(null);

    await svc.runWithSyncState('playerSync', async (ctx) => {
      expect(ctx.mode).toBe('incremental');
      expect(ctx.since?.toISOString()).toBe(lastCursor.toISOString());
      return {
        cursor: new Date('2024-01-04T00:00:00Z'),
        stats: { upserts: 2 },
        durationMs: 1200,
      };
    });

    const payload = upsertMock.mock.calls[0][0];
    expect(payload.job).toBe('playerSync');
    expect(payload.last_mode).toBe('incremental');
    expect(payload.last_full_sync_at?.toISOString()).toBe(
      lastFull.toISOString()
    );
    expect(payload.meta?.last_duration_ms).toBe(1200);
  });

  test('forceMode overrides cadence logic', async () => {
    const lastFull = new Date('2024-01-05T00:00:00Z');
    findOneMock.mockResolvedValue({
      job: 'teamSync',
      last_full_sync_at: lastFull,
      last_cursor: new Date('2024-01-06T00:00:00Z'),
    });
    upsertMock.mockResolvedValue(null);

    await svc.runWithSyncState(
      'teamSync',
      async (ctx) => {
        expect(ctx.mode).toBe('full');
        expect(ctx.since).toBeNull();
        return { stats: { upserts: 0 }, fullSync: true };
      },
      { forceMode: 'full' }
    );

    const payload = upsertMock.mock.calls[0][0];
    expect(payload.last_mode).toBe('full');
    expect(payload.last_full_sync_at instanceof Date).toBe(true);
  });
});

describe('getSyncState helpers', () => {
  test('getSyncState returns normalized payload', async () => {
    const row = {
      job: 'clubSync',
      last_cursor: new Date('2024-01-01T00:00:00Z'),
      last_mode: 'incremental',
      last_run_at: new Date('2024-01-02T00:00:00Z'),
      last_full_sync_at: new Date('2024-01-01T00:00:00Z'),
      meta: { last_stats: { upserts: 1 } },
      updated_at: new Date('2024-01-02T01:00:00Z'),
      created_at: new Date('2023-12-31T23:00:00Z'),
    };
    findOneMock.mockResolvedValue(row);

    const state = await svc.getSyncState('clubSync');
    expect(state).toEqual({
      job: 'clubSync',
      lastCursor: row.last_cursor,
      lastMode: 'incremental',
      lastRunAt: row.last_run_at,
      lastFullSyncAt: row.last_full_sync_at,
      meta: row.meta,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    });
  });

  test('getSyncStates builds map', async () => {
    const rows = [
      { job: 'clubSync', last_cursor: null, last_mode: 'full', meta: null },
      {
        job: 'teamSync',
        last_cursor: new Date('2024-02-01T00:00:00Z'),
        last_mode: 'incremental',
        meta: null,
      },
    ];
    findAllMock.mockResolvedValue(rows);
    const result = await svc.getSyncStates(['clubSync', 'teamSync']);
    expect(Object.keys(result)).toEqual(['clubSync', 'teamSync']);
    expect(result.clubSync.lastMode).toBe('full');
    expect(result.teamSync.lastCursor instanceof Date).toBe(true);
  });
});
