import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import ServiceError from '../src/errors/ServiceError.js';

const equipmentFindByPk = jest.fn();
const equipmentCreate = jest.fn();
const userFindByPk = jest.fn();
const hasRole = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  ...new Proxy(
    {
      Equipment: {
        findByPk: equipmentFindByPk,
        create: equipmentCreate,
      },
      File: {},
      MedicalCertificate: {},
      MedicalCertificateFile: {},
      MedicalCertificateType: {},
      EquipmentType: {},
      EquipmentManufacturer: {},
      EquipmentSize: {},
      User: { findByPk: userFindByPk },
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
      MedicalExamRegistration: {},
      MedicalExamRegistrationFile: {},
      MedicalExamRegistrationType: {},
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        const stub = {};
        target[prop] = stub;
        return stub;
      },
      getOwnPropertyDescriptor(target, prop) {
        if (!(prop in target)) {
          target[prop] = {};
        }
        return {
          configurable: true,
          enumerable: true,
          value: target[prop],
          writable: true,
        };
      },
    }
  ),
}));

jest.unstable_mockModule('../src/utils/roles.js', () => ({
  __esModule: true,
  hasRole,
}));

const { default: service } =
  await import('../src/services/equipmentService.js');

beforeEach(() => {
  equipmentFindByPk.mockReset();
  equipmentCreate.mockReset();
  userFindByPk.mockReset();
  hasRole.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('create enforces valid equipment number', async () => {
  await expect(
    service.create(
      { number: '0', type_id: 1, manufacturer_id: 1, size_id: 1 },
      'actor'
    )
  ).rejects.toBeInstanceOf(ServiceError);
  expect(equipmentCreate).not.toHaveBeenCalled();
});

test('update rejects missing equipment', async () => {
  equipmentFindByPk.mockResolvedValueOnce(null);
  await expect(service.update('unknown', {}, 'actor')).rejects.toMatchObject({
    code: 'equipment_not_found',
  });
});

test('assign validates ownership, existing assignments, and user roles', async () => {
  // existing assignment document blocks
  equipmentFindByPk.mockResolvedValueOnce({ assignment_document_id: 'doc' });
  await expect(service.assign('eq1', 'user1', 'actor')).rejects.toMatchObject({
    code: 'equipment_assignment_exists',
  });

  // assigned to another owner
  equipmentFindByPk.mockResolvedValueOnce({ owner_id: 'other' });
  await expect(service.assign('eq2', 'user1', 'actor')).rejects.toMatchObject({
    code: 'equipment_already_assigned',
  });

  // user not found
  equipmentFindByPk.mockResolvedValueOnce({
    owner_id: null,
    assignment_document_id: null,
  });
  userFindByPk.mockResolvedValueOnce(null);
  await expect(
    service.assign('eq3', 'user-missing', 'actor')
  ).rejects.toMatchObject({
    code: 'user_not_found',
  });

  // user lacks permitted role
  equipmentFindByPk.mockResolvedValueOnce({
    id: 'eq4',
    owner_id: null,
    assignment_document_id: null,
    EquipmentType: {},
    EquipmentManufacturer: {},
    EquipmentSize: {},
  });
  userFindByPk.mockResolvedValueOnce({ id: 'user-4', Roles: [] });
  hasRole.mockReturnValue(false);
  await expect(service.assign('eq4', 'user-4', 'actor')).rejects.toMatchObject({
    code: 'access_denied',
  });
});
