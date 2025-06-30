import { expect, test } from '@jest/globals';
import { PASSWORD_PATTERN } from '../src/config/auth.js';

test('default password pattern matches mixed letters and digits', () => {
  expect(PASSWORD_PATTERN.test('Passw0rd1')).toBe(true);
});

