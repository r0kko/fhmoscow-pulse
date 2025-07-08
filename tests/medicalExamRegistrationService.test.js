import { beforeEach, expect, jest, test } from '@jest/globals';

const findExamMock = jest.fn();
const findAllMock = jest.fn();
const createRegMock = jest.fn();
const findRegMock = jest.fn();
const updateMock = jest.fn();
const restoreMock = jest.fn();
const destroyMock = jest.fn();
const findStatusMock = jest.fn();
const findUserMock = jest.fn();

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
  User: { findByPk: findUserMock },
}));

const sendCreatedMock = jest.fn();
const sendApprovedMock = jest.fn();
const sendCancelledMock = jest.fn();
const sendSelfCancelledMock = jest.fn();
const sendCompletedMock = jest.fn();

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendMedicalExamRegistrationCreatedEmail: sendCreatedMock,
    sendMedicalExamRegistrationApprovedEmail: sendApprovedMock,
    sendMedicalExamRegistrationCancelledEmail: sendCancelledMock,
    sendMedicalExamRegistrationSelfCancelledEmail: sendSelfCancelledMock,
    sendMedicalExamRegistrationCompletedEmail: sendCompletedMock,
  },
}));

const { default: service } = await import('../src/services/medicalExamRegistrationService.js');

beforeEach(() => {
  findExamMock.mockReset();
  findAllMock.mockReset();
  createRegMock.mockReset();
  findRegMock.mockReset();
  updateMock.mockReset();
  restoreMock.mockReset();
  destroyMock.mockReset();
  findStatusMock.mockReset();
  findStatusMock.mockImplementation(({ where: { alias } }) => statuses[alias]);
  findUserMock.mockReset();
  sendCreatedMock.mockClear();
  sendApprovedMock.mockClear();
  sendCancelledMock.mockClear();
  sendSelfCancelledMock.mockClear();
  sendCompletedMock.mockClear();
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
  findRegMock
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null);
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.register('u1', 'e1', 'u1');
  expect(findRegMock).toHaveBeenNthCalledWith(1, {
    where: { medical_exam_id: 'e1', user_id: 'u1' },
    paranoid: false,
  });
  expect(createRegMock).toHaveBeenCalledWith({
    medical_exam_id: 'e1',
    user_id: 'u1',
    status_id: statuses.PENDING.id,
    created_by: 'u1',
    updated_by: 'u1',
  });
  expect(sendCreatedMock).toHaveBeenCalledWith(
    { id: 'u1', email: 'e' },
    exam
  );
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

test('register restores soft deleted registration', async () => {
  findExamMock.mockResolvedValue(exam);
  findRegMock
    .mockResolvedValueOnce({ deletedAt: new Date(), restore: restoreMock, update: updateMock })
    .mockResolvedValueOnce(null);
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.register('u1', 'e1', 'u1');
  expect(restoreMock).toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith({
    status_id: statuses.PENDING.id,
    created_by: 'u1',
    updated_by: 'u1',
  });
  expect(createRegMock).not.toHaveBeenCalled();
  expect(sendCreatedMock).toHaveBeenCalled();
});

test('unregister removes pending registration', async () => {
  findRegMock.mockResolvedValue({
    status_id: statuses.PENDING.id,
    destroy: destroyMock,
  });
  findExamMock.mockResolvedValue(exam);
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.unregister('u1', 'e1');
  expect(destroyMock).toHaveBeenCalled();
  expect(sendSelfCancelledMock).toHaveBeenCalledWith({ id: 'u1', email: 'e' }, exam);
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
  expect(rows[0].available).toBe(1);
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

test('setStatus sends email on approval', async () => {
  findRegMock.mockResolvedValue({ update: updateMock });
  findExamMock.mockResolvedValue(exam);
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.setStatus('e1', 'u1', 'APPROVED', 'admin');
  expect(updateMock).toHaveBeenCalledWith({ status_id: statuses.APPROVED.id, updated_by: 'admin' });
  expect(sendApprovedMock).toHaveBeenCalledWith({ id: 'u1', email: 'e' }, exam);
});

test('remove sends cancellation email', async () => {
  findRegMock.mockResolvedValue({ destroy: destroyMock });
  findExamMock.mockResolvedValue(exam);
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.remove('e1', 'u1');
  expect(destroyMock).toHaveBeenCalled();
  expect(sendCancelledMock).toHaveBeenCalledWith({ id: 'u1', email: 'e' }, exam);
});

