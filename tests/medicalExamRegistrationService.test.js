import { beforeEach, expect, jest, test } from '@jest/globals';

const findExamMock = jest.fn();
const findAllMock = jest.fn();
const createRegMock = jest.fn();
const findRegMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();
const findStatusMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  MedicalExam: { findByPk: findExamMock, findAndCountAll: findAllMock },
  MedicalExamRegistration: {
    create: createRegMock,
    findOne: findRegMock,
  },
  MedicalExamRegistrationStatus: { findOne: findStatusMock },
  MedicalCenter: {},
  Address: {},
  User: {},
}));

const { default: service } = await import('../src/services/medicalExamRegistrationService.js');

beforeEach(() => {
  findExamMock.mockReset();
  findAllMock.mockReset();
  createRegMock.mockReset();
  findRegMock.mockReset();
  updateMock.mockReset();
  destroyMock.mockReset();
  findStatusMock.mockReset();
  findStatusMock.mockImplementation(({ where: { alias } }) => statuses[alias]);
});

const exam = {
  id: 'e1',
  start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  capacity: 2,
  MedicalExamRegistrations: [],
};

const statuses = {
  PENDING: { id: 's1', alias: 'PENDING' },
  APPROVED: { id: 's2', alias: 'APPROVED' },
  CANCELED: { id: 's3', alias: 'CANCELED' },
  COMPLETED: { id: 's4', alias: 'COMPLETED' },
};

test('register creates new registration', async () => {
  findExamMock.mockResolvedValue(exam);
  findRegMock.mockResolvedValue(null);
  await service.register('u1', 'e1', 'u1');
  expect(findRegMock).toHaveBeenCalledWith({
    where: { medical_exam_id: 'e1', user_id: 'u1' },
  });
  expect(createRegMock).toHaveBeenCalledWith({
    medical_exam_id: 'e1',
    user_id: 'u1',
    status_id: statuses.PENDING.id,
    created_by: 'u1',
    updated_by: 'u1',
  });
});

test('register fails if already registered', async () => {
  findExamMock.mockResolvedValue(exam);
  findRegMock.mockResolvedValue({ id: 'r1' });
  await expect(service.register('u1', 'e1', 'u1')).rejects.toBeTruthy();
});

test('register fails when another active registration exists', async () => {
  findExamMock.mockResolvedValue(exam);
  findRegMock
    .mockResolvedValueOnce(null) // check same exam
    .mockResolvedValueOnce({ id: 'r2' }); // check other active
  await expect(service.register('u1', 'e1', 'u1')).rejects.toBeTruthy();
});

test('unregister removes pending registration', async () => {
  findRegMock.mockResolvedValue({
    status_id: statuses.PENDING.id,
    destroy: destroyMock,
  });
  await service.unregister('u1', 'e1');
  expect(destroyMock).toHaveBeenCalled();
});

test('unregister fails when approved', async () => {
  findRegMock.mockResolvedValue({ status_id: statuses.APPROVED.id });
  await expect(service.unregister('u1', 'e1')).rejects.toBeTruthy();
});

test('listAvailable returns mapped exams', async () => {
  findAllMock.mockResolvedValue({
    rows: [
      {
        capacity: 1,
        MedicalExamRegistrations: [{
          user_id: 'u1',
          MedicalExamRegistrationStatus: { alias: 'PENDING' },
        }],
        get: () => ({ id: 'e1', start_at: '2025-07-10T10:00:00Z', capacity: 1, MedicalCenter: { id: 'c1', name: 'C1', Address: { result: 'addr', metro: [] } } })
      }
    ],
    count: 1,
  });
  const { rows } = await service.listAvailable('u1');
  expect(findAllMock).toHaveBeenCalled();
  expect(rows[0].available).toBe(0);
  expect(rows[0].registration_count).toBe(1);
  expect(rows[0].approved_count).toBe(0);
  expect(rows[0].registration_status).toBe('PENDING');
});

test('listUpcomingByUser filters by user', async () => {
  findAllMock.mockResolvedValue({
    rows: [
      {
        capacity: 1,
        MedicalExamRegistrations: [{
          user_id: 'u1',
          MedicalExamRegistrationStatus: { alias: 'APPROVED' },
        }],
        get: () => ({
          id: 'e1',
          start_at: '2025-07-10T10:00:00Z',
          capacity: 1,
          MedicalCenter: { id: 'c1', name: 'C1', Address: { result: 'addr', metro: [] } },
        }),
      },
    ],
    count: 1,
  });
  const { rows } = await service.listUpcomingByUser('u1');
  expect(findAllMock).toHaveBeenCalled();
  expect(rows[0].user_registered).toBe(true);
  expect(rows[0].registration_count).toBe(1);
  expect(rows[0].approved_count).toBe(1);
  expect(rows[0].registration_status).toBe('APPROVED');
});

