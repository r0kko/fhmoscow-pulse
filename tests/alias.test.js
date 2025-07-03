import { expect, test } from '@jest/globals';
import generateAlias from '../src/utils/alias.js';

test('generateAlias transliterates and uppercases', () => {
  expect(generateAlias('Тестовый сезон')).toBe('TESTOVYY_SEZON');
});
