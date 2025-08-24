import { expect, test } from '@jest/globals';
import { ensureArchivedImported } from '../src/utils/sync.js';

test('ensureArchivedImported handles non-function mapFn', async () => {
  const LocalModel = {
    findAll: async () => [],
    create: async () => {},
  };
  const created = await ensureArchivedImported(LocalModel, [{ id: 1 }], null, 'actor', null);
  expect(created).toBe(1);
});

