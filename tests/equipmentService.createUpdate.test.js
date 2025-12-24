import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const equipmentFindByPk = jest.fn();
const equipmentCreate = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Equipment: {
    findByPk: equipmentFindByPk,
    create: equipmentCreate,
  },
  EquipmentType: {},
  EquipmentManufacturer: {},
  EquipmentSize: {},
  User: {},
  Role: {},
  Document: {},
  DocumentStatus: {},
  DocumentType: {},
  SignType: {},
  UserSignType: {},
  Ticket: {},
  TicketStatus: {},
  TicketType: {},
  TicketFile: {},
  File: {},
  MedicalCertificate: {},
  MedicalCertificateFile: {},
  MedicalCertificateType: {},
}));

const { default: service } =
  await import('../src/services/equipmentService.js');

beforeEach(() => {
  equipmentFindByPk.mockReset();
  equipmentCreate.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('create normalizes and persists equipment number', async () => {
  equipmentCreate.mockResolvedValue({ id: 'eq-1' });
  equipmentFindByPk.mockResolvedValue({ id: 'eq-1', number: 7 });
  const created = await service.create(
    { number: '007', type_id: 1, manufacturer_id: 2, size_id: 3 },
    'actor'
  );
  expect(equipmentCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      number: 7,
      created_by: 'actor',
      updated_by: 'actor',
    })
  );
  expect(created).toEqual({ id: 'eq-1', number: 7 });
});

test('update strips empty number and re-fetches entity', async () => {
  const update = jest.fn().mockResolvedValue({});
  equipmentFindByPk
    .mockResolvedValueOnce({ id: 'eq-2', update })
    .mockResolvedValueOnce({ id: 'eq-2', number: 10 });
  const updated = await service.update(
    'eq-2',
    { number: '', type_id: 5 },
    'actor-2'
  );
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ updated_by: 'actor-2' })
  );
  expect(updated).toEqual({ id: 'eq-2', number: 10 });
});
