import { describe, expect, test } from '@jest/globals';
import {
  statusFilters,
  ensureArchivedImported,
  buildSinceClause,
  normalizeSyncOptions,
} from '../src/utils/sync.js';
import { Op } from 'sequelize';

describe('statusFilters', () => {
  test('provides case/trim tolerant filters', () => {
    const { ACTIVE, NEW, ACTIVE_OR_NEW, ARCHIVE } =
      statusFilters('object_status');
    expect(ACTIVE).toBeDefined();
    expect(NEW).toBeDefined();
    expect(ACTIVE_OR_NEW).toBeDefined();
    expect(ARCHIVE).toBeDefined();
  });

  test('ensureArchivedImported inserts missing rows as soft-deleted', async () => {
    const calls = { create: 0 };
    const LocalModel = {
      findAll: async () => [],
      create: async () => {
        calls.create += 1;
      },
    };
    const created = await ensureArchivedImported(
      LocalModel,
      [{ id: 123 }],
      () => ({ name: 'X' }),
      'actor-id',
      null
    );
    expect(created).toBe(1);
    expect(calls.create).toBe(1);
  });

  test('ensureArchivedImported with no archived records returns 0', async () => {
    const LocalModel = {
      findAll: async () => {
        throw new Error('should not be called');
      },
      create: async () => {},
    };
    const created = await ensureArchivedImported(
      LocalModel,
      [],
      () => ({}),
      null,
      null
    );
    expect(created).toBe(0);
  });
});

describe('buildSinceClause', () => {
  test('returns null when since is falsy', () => {
    expect(buildSinceClause(null)).toBeNull();
    expect(buildSinceClause(undefined)).toBeNull();
  });

  test('produces OR clause for provided fields', () => {
    const since = new Date('2024-01-01T00:00:00Z');
    const clause = buildSinceClause(since, ['updated_at', 'created_at']);
    expect(clause).toHaveProperty([Op.or]);
    const ors = clause[Op.or];
    expect(Array.isArray(ors)).toBe(true);
    expect(ors).toHaveLength(2);
    expect(ors[0]).toHaveProperty('updated_at');
    expect(ors[1]).toHaveProperty('created_at');
  });
});

describe('normalizeSyncOptions', () => {
  test('coerces primitive actor id to full options', () => {
    const normalized = normalizeSyncOptions('actor-1');
    expect(normalized.actorId).toBe('actor-1');
    expect(normalized.mode).toBe('full');
    expect(normalized.fullResync).toBe(true);
  });

  test('respects incremental mode when since is supplied', () => {
    const since = new Date('2024-01-02T00:00:00Z');
    const normalized = normalizeSyncOptions({
      actorId: 'admin',
      mode: 'incremental',
      since,
    });
    expect(normalized.actorId).toBe('admin');
    expect(normalized.mode).toBe('incremental');
    expect(normalized.since?.toISOString()).toBe(since.toISOString());
    expect(normalized.fullResync).toBe(false);
  });

  test('falls back to full sync when since is invalid', () => {
    const normalized = normalizeSyncOptions({
      mode: 'incremental',
      since: 'oops',
    });
    expect(normalized.mode).toBe('full');
    expect(normalized.fullResync).toBe(true);
  });
});
