import { describe, expect, test } from '@jest/globals';
import { statusFilters, ensureArchivedImported } from '../src/utils/sync.js';

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
