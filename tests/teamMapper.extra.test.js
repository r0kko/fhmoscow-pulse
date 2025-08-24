import { expect, test } from '@jest/globals';

const { default: mapper } = await import('../src/mappers/teamMapper.js');

test('toPublic maps club and grounds when present', () => {
  const input = {
    id: 't1',
    external_id: 10,
    name: 'Команда',
    birth_year: 2010,
    club_id: 'c1',
    Club: { id: 'c1', name: 'Клуб 1' },
    Grounds: [
      { id: 'g1', name: 'Арена 1' },
      { id: 'g2', name: 'Арена 2' },
    ],
  };
  const out = mapper.toPublic(input);
  expect(out.club).toEqual({ id: 'c1', name: 'Клуб 1' });
  expect(out.grounds.map((g) => g.name)).toEqual(['Арена 1', 'Арена 2']);
});

