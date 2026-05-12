import { readFile } from 'node:fs/promises';
import { expect, test } from '@jest/globals';

test('profile role assignment route requires the administrator role group', async () => {
  const source = await readFile(
    new URL('../src/routes/users.js', import.meta.url),
    'utf8'
  );

  expect(source).toMatch(
    /router\.put\(\s*['"]\/:id\/profile\/roles['"],\s*auth,\s*authorize\(['"]ADMINISTRATOR['"]\)/
  );
});
