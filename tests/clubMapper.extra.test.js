import { expect, test } from '@jest/globals';

const { default: mapper } = await import('../src/mappers/clubMapper.js');

test('toPublic maps grounds when present', () => {
  const club = {
    id: 'c10',
    external_id: 100,
    name: 'Клуб 10',
    Grounds: [
      { id: 'g1', name: 'Арена 1' },
      { id: 'g2', name: 'Арена 2' },
    ],
  };
  const out = mapper.toPublic(club);
  expect(out.grounds).toEqual([
    { id: 'g1', name: 'Арена 1' },
    { id: 'g2', name: 'Арена 2' },
  ]);
});

