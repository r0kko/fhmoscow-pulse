import { expect, test } from '@jest/globals';
import { ensureArchivedImported } from '../src/utils/sync.js';

test('ensureArchivedImported skips create when local exists', async () => {
  const LocalModel = {
    findAll: async () => [{ external_id: 42 }],
    create: async () => {
      throw new Error('should not create for existing');
    },
  };
  const created = await ensureArchivedImported(
    LocalModel,
    [{ id: 42 }],
    () => ({ name: 'X' }),
    'actor',
    null
  );
  expect(created).toBe(0);
});

