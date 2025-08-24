import { describe, expect, test } from '@jest/globals';
import mapper from '../src/mappers/groundMapper.js';

describe('groundMapper', () => {
  test('toPublic returns null for falsy input', () => {
    expect(mapper.toPublic(null)).toBeNull();
    expect(mapper.toPublic(undefined)).toBeNull();
  });

  test('toPublic unwraps model instance and maps address', () => {
    const ground = {
      get: () => ({
        id: 'g1',
        external_id: 123,
        name: 'Main Arena',
        yandex_url: 'https://yandex.ru/maps',
        createdAt: 'ignored',
        updatedAt: 'ignored',
        deletedAt: null,
        Address: {
          id: 'a1',
          result: 'Moscow, Tverskaya 1',
          geo_lat: '55.0',
          geo_lon: '37.0',
          metro: 'Tverskaya',
        },
      }),
    };
    expect(mapper.toPublic(ground)).toEqual({
      id: 'g1',
      external_id: 123,
      name: 'Main Arena',
      yandex_url: 'https://yandex.ru/maps',
      address: {
        id: 'a1',
        result: 'Moscow, Tverskaya 1',
        geo_lat: '55.0',
        geo_lon: '37.0',
        metro: 'Tverskaya',
      },
    });
  });

  test('toPublic accepts plain objects', () => {
    const ground = {
      id: 'g2',
      external_id: 456,
      name: 'Old Arena',
      yandex_url: null,
      Address: undefined,
      created_at: 'ignored',
      updated_at: 'ignored',
      deleted_at: null,
    };
    expect(mapper.toPublic(ground)).toEqual({
      id: 'g2',
      external_id: 456,
      name: 'Old Arena',
      yandex_url: null,
    });
  });

  test('toPublic maps attached clubs and teams', () => {
    const ground = {
      id: 'g3',
      name: 'Arena C',
      Clubs: [
        { id: 'c1', name: 'Клуб 1' },
        { id: 'c2', name: 'Клуб 2' },
      ],
      Teams: [
        { id: 't1', name: 'Команда 1', birth_year: 2010, club_id: 'c1' },
        { id: 't2', name: 'Команда 2', birth_year: 2011, club_id: 'c2' },
      ],
    };
    const out = mapper.toPublic(ground);
    expect(out.clubs).toEqual([
      { id: 'c1', name: 'Клуб 1' },
      { id: 'c2', name: 'Клуб 2' },
    ]);
    expect(out.teams).toEqual([
      { id: 't1', name: 'Команда 1', birth_year: 2010, club_id: 'c1' },
      { id: 't2', name: 'Команда 2', birth_year: 2011, club_id: 'c2' },
    ]);
  });
});
