import { expect, test } from '@jest/globals';

const { default: mapper } =
  await import('../src/mappers/normativeZoneMapper.js');

test('toPublic returns null for falsy zone', () => {
  expect(mapper.toPublic(null)).toBeNull();
});

test('toPublic unwraps model instance via get()', () => {
  const zone = {
    get: () => ({ id: 'z1', name: 'Основная', alias: 'BASE', color: '#fff' }),
  };
  expect(mapper.toPublic(zone)).toEqual({
    id: 'z1',
    name: 'Основная',
    alias: 'BASE',
    color: '#fff',
  });
});
