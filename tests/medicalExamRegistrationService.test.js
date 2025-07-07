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
  await service.register('u1', 'e1', 'u1');
  expect(createRegMock).toHaveBeenCalled();
});

test('register restores deleted registration', async () => {
  findExamMock.mockResolvedValue({
    ...exam,
    MedicalExamRegistrations: [
      { user_id: 'u1', deletedAt: new Date(), restore: restoreMock, update: updateMock },
    ],
  });
  await service.register('u1', 'e1', 'u1');
  expect(restoreMock).toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalled();
});

test('unregister removes registration', async () => {
  findRegMock.mockResolvedValue({ destroy: destroyMock });
  await service.unregister('u1', 'e1');
  expect(destroyMock).toHaveBeenCalled();
});

test('listAvailable returns mapped exams', async () => {
  findAllMock.mockResolvedValue({
    rows: [
      {
        capacity: 1,
        MedicalExamRegistrations: [],
        get: () => ({ id: 'e1', start_at: '2025-07-10T10:00:00Z', capacity: 1, MedicalCenter: { id: 'c1', name: 'C1' } })
      }
    ],
    count: 1,
  });
  const { rows } = await service.listAvailable('u1');
  expect(findAllMock).toHaveBeenCalled();
  expect(rows[0].available).toBe(1);
});

test('listUpcomingByUser filters by user', async () => {
  findAllMock.mockResolvedValue({
    rows: [
      {
        capacity: 1,
        MedicalExamRegistrations: [{ user_id: 'u1' }],
        get: () => ({
          id: 'e1',
          start_at: '2025-07-10T10:00:00Z',
          capacity: 1,
          MedicalCenter: { id: 'c1', name: 'C1' },
        }),
      },
    ],
    count: 1,
  });
  const { rows } = await service.listUpcomingByUser('u1');
  expect(findAllMock).toHaveBeenCalled();
  expect(rows[0].user_registered).toBe(true);
});

