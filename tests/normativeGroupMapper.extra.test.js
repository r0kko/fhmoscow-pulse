import { expect, test } from '@jest/globals';

const { default: mapper } = await import('../src/mappers/normativeGroupMapper.js');

test('toPublic returns null for falsy group', () => {
  expect(mapper.toPublic(null)).toBeNull();
});

test('toPublic handles model instance via get()', () => {
  const group = {
    get: () => ({ id: 'g1', season_id: 's1', name: 'Бег', alias: 'RUN', required: true }),
  };
  expect(mapper.toPublic(group)).toEqual({ id: 'g1', season_id: 's1', name: 'Бег', alias: 'RUN', required: true });
});

