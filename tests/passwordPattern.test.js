import { beforeEach, expect, jest, test } from '@jest/globals';

beforeEach(() => {
  jest.resetModules();
  // eslint-disable-next-line no-undef
  delete process.env.PASSWORD_PATTERN;
});

test('default password pattern matches mixed letters and digits', async () => {
  const { PASSWORD_PATTERN } = await import('../src/config/auth.js');
  expect(PASSWORD_PATTERN.test('Passw0rd1')).toBe(true);
});

test('throws error for unsafe password pattern', async () => {
  // eslint-disable-next-line no-undef
  process.env.PASSWORD_PATTERN = '(a+)+$';
  await expect(import('../src/config/auth.js')).rejects.toThrow(
    'Unsafe PASSWORD_PATTERN'
  );
});
