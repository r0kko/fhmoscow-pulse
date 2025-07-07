import { beforeEach, expect, jest, test } from '@jest/globals';

const findExamMock = jest.fn();
const findAllMock = jest.fn();
const createRegMock = jest.fn();
const findRegMock = jest.fn();
const restoreMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  MedicalExam: { findByPk: findExamMock, findAndCountAll: findAllMock },
  MedicalExamRegistration: {
    create: createRegMock,
    findOne: findRegMock,
  },
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
  restoreMock.mockReset();
  updateMock.mockReset();
  destroyMock.mockReset();
});

const exam = {
  id: 'e1',
  start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  capacity: 2,
  MedicalExamRegistrations: [],
};

test('register creates new registration', async () => {
  findExamMock.mockResolvedValue(exam);
  findRegMock.mockResolvedValue(null);
  await service.register('u1', 'e1', 'u1');
  expect(findRegMock).toHaveBeenCalledWith({
    where: { medical_exam_id: 'e1', user_id: 'u1' },
    paranoid: false,
  });
  expect(createRegMock).toHaveBeenCalledWith({
    medical_exam_id: 'e1',
    user_id: 'u1',
    approved: null,
    created_by: 'u1',
    updated_by: 'u1',
  });
});

test('register restores deleted registration', async () => {
  findExamMock.mockResolvedValue(exam);
  findRegMock.mockResolvedValue({
    user_id: 'u1',
    deletedAt: new Date(),
    restore: restoreMock,
    update: updateMock,
  });
  await service.register('u1', 'e1', 'u1');
  expect(findRegMock).toHaveBeenCalled();
  expect(restoreMock).toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith({ approved: null, updated_by: 'u1' });
});

test('unregister removes registration', async () => {
  findRegMock.mockResolvedValue({ approved: null, destroy: destroyMock });
  await service.unregister('u1', 'e1');
  expect(destroyMock).toHaveBeenCalled();
});

test('unregister fails when approved', async () => {
  findRegMock.mockResolvedValue({ approved: true });
  await expect(service.unregister('u1', 'e1')).rejects.toBeTruthy();
});

test('listAvailable returns mapped exams', async () => {
  findAllMock.mockResolvedValue({
    rows: [
      {
        capacity: 1,
        MedicalExamRegistrations: [{ user_id: 'u1', approved: null }],
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
  expect(rows[0].registration_status).toBe('pending');
});

test('listUpcomingByUser filters by user', async () => {
  findAllMock.mockResolvedValue({
    rows: [
      {
        capacity: 1,
        MedicalExamRegistrations: [{ user_id: 'u1', approved: true }],
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
  expect(rows[0].registration_status).toBe('approved');
});

