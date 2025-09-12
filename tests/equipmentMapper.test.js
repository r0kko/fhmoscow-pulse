import { describe, expect, test } from '@jest/globals';
import mapper from '../src/mappers/equipmentMapper.js';

describe('equipmentMapper', () => {
  test('toPublic returns null for falsy', () => {
    expect(mapper.toPublic(null)).toBeNull();
    expect(mapper.toPublic(undefined)).toBeNull();
  });

  test('toPublic unwraps model and maps nested', () => {
    const item = {
      get: () => ({
        id: 'e1',
        number: 12,
        EquipmentType: { id: 't1', name: 'Свитер главного судьи' },
        EquipmentManufacturer: { id: 'm1', name: 'ZEDO' },
        EquipmentSize: { id: 's1', name: '54' },
      }),
    };
    expect(mapper.toPublic(item)).toEqual({
      id: 'e1',
      number: 12,
      type: { id: 't1', name: 'Свитер главного судьи' },
      manufacturer: { id: 'm1', name: 'ZEDO' },
      size: { id: 's1', name: '54' },
      owner: null,
      document_id: null,
    });
  });

  test('toPublic accepts plain object', () => {
    const item = {
      id: 'e2',
      number: 5,
      EquipmentType: { id: 't2', name: 'Свитер линейного судьи' },
      EquipmentManufacturer: { id: 'm1', name: 'ZEDO' },
      EquipmentSize: { id: 's3', name: '50' },
    };
    expect(mapper.toPublic(item)).toEqual({
      id: 'e2',
      number: 5,
      type: { id: 't2', name: 'Свитер линейного судьи' },
      manufacturer: { id: 'm1', name: 'ZEDO' },
      size: { id: 's3', name: '50' },
      owner: null,
      document_id: null,
    });
  });
});
