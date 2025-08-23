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
});

