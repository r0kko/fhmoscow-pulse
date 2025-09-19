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
      document: null,
      status: 'free',
      created_at: null,
      updated_at: null,
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
      document: null,
      status: 'free',
      created_at: null,
      updated_at: null,
    });
  });

  test('status reflects owner or pending document', () => {
    const awaiting = {
      id: 'e3',
      number: 7,
      EquipmentType: { id: 't2', name: 'Штаны' },
      EquipmentManufacturer: { id: 'm1', name: 'ZEDO' },
      EquipmentSize: { id: 's4', name: '48' },
      assignment_document_id: 'doc1',
    };
    expect(mapper.toPublic(awaiting).status).toBe('awaiting');

    const issued = {
      id: 'e4',
      number: 9,
      EquipmentType: { id: 't3', name: 'Шлем' },
      EquipmentManufacturer: { id: 'm2', name: 'Brand' },
      EquipmentSize: { id: 's5', name: '56' },
      Owner: {
        id: 'u1',
        first_name: 'Иван',
        last_name: 'Иванов',
        patronymic: 'Иванович',
      },
    };
    expect(mapper.toPublic(issued).status).toBe('issued');
  });

  test('owner contact details are included when available', () => {
    const item = {
      id: 'e-contact',
      number: 15,
      EquipmentType: { id: 't1', name: 'Нагрудник' },
      EquipmentManufacturer: { id: 'm1', name: 'ZEDO' },
      EquipmentSize: { id: 's2', name: '52' },
      Owner: {
        id: 'u42',
        first_name: 'Мария',
        last_name: 'Петрова',
        patronymic: 'Александровна',
        email: 'mp@example.com',
        phone: '+7 900 111-22-33',
      },
    };
    expect(mapper.toPublic(item).owner).toEqual({
      id: 'u42',
      first_name: 'Мария',
      last_name: 'Петрова',
      patronymic: 'Александровна',
      email: 'mp@example.com',
      phone: '+7 900 111-22-33',
    });
  });

  test('includes assignment document meta when present', () => {
    const item = {
      id: 'e5',
      number: 3,
      EquipmentType: { id: 't1', name: 'Шлем' },
      EquipmentManufacturer: { id: 'm2', name: 'Brand' },
      EquipmentSize: { id: 's2', name: '52' },
      assignment_document_id: 'd1',
      AssignmentDocument: {
        id: 'd1',
        number: '25.01/10',
        DocumentStatus: {
          alias: 'AWAITING_SIGNATURE',
          name: 'Ожидает подписи',
        },
      },
    };
    expect(mapper.toPublic(item)).toEqual({
      id: 'e5',
      number: 3,
      type: { id: 't1', name: 'Шлем' },
      manufacturer: { id: 'm2', name: 'Brand' },
      size: { id: 's2', name: '52' },
      owner: null,
      document_id: 'd1',
      document: {
        id: 'd1',
        number: '25.01/10',
        status: { alias: 'AWAITING_SIGNATURE', name: 'Ожидает подписи' },
      },
      status: 'awaiting',
      created_at: null,
      updated_at: null,
    });
  });
});
