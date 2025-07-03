import { beforeEach, expect, jest, test } from '@jest/globals';

const findTrainingMock = jest.fn();
const findGroupUserMock = jest.fn();
const createRegMock = jest.fn();
const findUserMock = jest.fn();
const findRegMock = jest.fn();
const destroyMock = jest.fn();
const findTrainingRoleMock = jest.fn();
const findRoleMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Training: { findByPk: findTrainingMock },
  TrainingType: {},
  CampStadium: {},
  Season: {},
  RefereeGroup: {},
  Address: {},
  TrainingRole: { findOne: findTrainingRoleMock, findByPk: findTrainingRoleMock },
  RefereeGroupUser: { findOne: findGroupUserMock },
  TrainingRegistration: {
    create: createRegMock,
    findOne: findRegMock,
  },
  User: { findByPk: findUserMock },
  Role: { findOne: findRoleMock },
}));

const isOpenMock = jest.fn(() => true);

jest.unstable_mockModule('../src/services/trainingService.js', () => ({
  __esModule: true,
  default: { isRegistrationOpen: isOpenMock },
}));

const sendRegEmailMock = jest.fn();
const sendCancelEmailMock = jest.fn();
const sendRoleChangedEmailMock = jest.fn();

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendTrainingRegistrationEmail: sendRegEmailMock,
    sendTrainingRegistrationCancelledEmail: sendCancelEmailMock,
    sendTrainingRoleChangedEmail: sendRoleChangedEmailMock,
  },
}));

const { default: service } = await import('../src/services/trainingRegistrationService.js');

beforeEach(() => {
  findTrainingMock.mockReset();
  findGroupUserMock.mockReset();
  createRegMock.mockReset();
  findUserMock.mockReset();
  findRegMock.mockReset();
  destroyMock.mockReset();
  findRoleMock.mockReset();
  sendRegEmailMock.mockClear();
  sendCancelEmailMock.mockClear();
  sendRoleChangedEmailMock.mockClear();
  findRegMock.mockResolvedValue(null);
  findTrainingRoleMock.mockResolvedValue({ id: 'role1' });
});

const training = {
  id: 't1',
  start_at: '2024-01-01T10:00:00Z',
  RefereeGroups: [{ id: 'g1' }],
  TrainingRegistrations: [],
};

findRegMock.mockImplementation(() => ({ destroy: destroyMock }));

test('register sends confirmation email', async () => {
  findTrainingMock.mockResolvedValue(training);
  findGroupUserMock.mockResolvedValue({ user_id: 'u1', group_id: 'g1' });
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.register('u1', 't1', 'u1');
  expect(createRegMock).toHaveBeenCalled();
  expect(sendRegEmailMock).toHaveBeenCalledWith(
    { id: 'u1', email: 'e' },
    training,
    { id: 'role1' }
  );
});

test('register restores deleted registration', async () => {
  const restoreMock = jest.fn();
  const updateMock = jest.fn();
  findTrainingMock.mockResolvedValue(training);
  findGroupUserMock.mockResolvedValue({ user_id: 'u1', group_id: 'g1' });
  findRegMock.mockResolvedValue({
    deletedAt: new Date(),
    restore: restoreMock,
    update: updateMock,
  });
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.register('u1', 't1', 'u1');
  expect(restoreMock).toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith({ training_role_id: 'role1', updated_by: 'u1' });
  expect(createRegMock).not.toHaveBeenCalled();
  expect(sendRegEmailMock).toHaveBeenCalled();
});

test('remove sends cancellation email', async () => {
  findRegMock.mockResolvedValue({ destroy: destroyMock });
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  findTrainingMock.mockResolvedValue(training);
  await service.remove('t1', 'u1');
  expect(destroyMock).toHaveBeenCalled();
  expect(sendCancelEmailMock).toHaveBeenCalledWith({ id: 'u1', email: 'e' }, training);
});

test('add creates registration for referee', async () => {
  const tr = { ...training, TrainingRegistrations: [] };
  findTrainingMock.mockResolvedValue(tr);
  findUserMock.mockResolvedValue({ id: 'u2', email: 'e2', Roles: [{ alias: 'REFEREE' }] });
  await service.add('t1', 'u2', 'role2', 'admin');
  expect(createRegMock).toHaveBeenCalledWith({
    training_id: 't1',
    user_id: 'u2',
    training_role_id: 'role2',
    created_by: 'admin',
    updated_by: 'admin',
  });
  expect(sendRegEmailMock).toHaveBeenCalledWith(
    { id: 'u2', email: 'e2', Roles: [{ alias: 'REFEREE' }] },
    tr,
    { id: 'role1' }
  );
});

test('add restores deleted registration', async () => {
  const tr = { ...training, TrainingRegistrations: [] };
  const restoreMock = jest.fn();
  const updateMock = jest.fn();
  findTrainingMock.mockResolvedValue(tr);
  findUserMock.mockResolvedValue({ id: 'u2', email: 'e2', Roles: [{ alias: 'REFEREE' }] });
  findRegMock.mockResolvedValue({
    deletedAt: new Date(),
    restore: restoreMock,
    update: updateMock,
  });
  await service.add('t1', 'u2', 'role2', 'admin');
  expect(restoreMock).toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith({ training_role_id: 'role2', updated_by: 'admin' });
  expect(createRegMock).not.toHaveBeenCalled();
  expect(sendRegEmailMock).toHaveBeenCalledWith(
    { id: 'u2', email: 'e2', Roles: [{ alias: 'REFEREE' }] },
    tr,
    { id: 'role1' }
  );
});

test('register rejects when training is full', async () => {
  const tr = {
    id: 't1',
    start_at: '2024-01-01T10:00:00Z',
    capacity: 1,
    RefereeGroups: [{ id: 'g1' }],
    TrainingRegistrations: [{ TrainingRole: { alias: 'PARTICIPANT' } }],
  };
  findTrainingMock.mockResolvedValue(tr);
  findGroupUserMock.mockResolvedValue({ user_id: 'u1', group_id: 'g1' });
  await expect(service.register('u1', 't1', 'u1')).rejects.toThrow(
    'training_full'
  );
});

test('updateRole sends notification', async () => {
  const updateMock = jest.fn();
  findRegMock.mockResolvedValue({ update: updateMock });
  findTrainingMock.mockResolvedValue(training);
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.updateRole('t1', 'u1', 'role3', 'admin');
  expect(updateMock).toHaveBeenCalledWith({ training_role_id: 'role3', updated_by: 'admin' });
  expect(sendRoleChangedEmailMock).toHaveBeenCalledWith({ id: 'u1', email: 'e' }, training, { id: 'role1' });
});
