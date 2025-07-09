import { beforeEach, expect, jest, test } from '@jest/globals';

const findTrainingMock = jest.fn();
const findAndCountAllMock = jest.fn();
const findGroupUserMock = jest.fn();
const createRegMock = jest.fn();
const findUserMock = jest.fn();
const findRegMock = jest.fn();
const destroyMock = jest.fn();
const findTrainingRoleMock = jest.fn();
const findRoleMock = jest.fn();
const countMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Training: { findByPk: findTrainingMock, findAndCountAll: findAndCountAllMock },
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
    count: countMock,
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
const sendSelfCancelEmailMock = jest.fn();

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  default: {
    sendTrainingRegistrationEmail: sendRegEmailMock,
    sendTrainingRegistrationCancelledEmail: sendCancelEmailMock,
    sendTrainingRegistrationSelfCancelledEmail: sendSelfCancelEmailMock,
    sendTrainingRoleChangedEmail: sendRoleChangedEmailMock,
  },
}));

const { default: service } = await import('../src/services/trainingRegistrationService.js');

beforeEach(() => {
  findTrainingMock.mockReset();
  findAndCountAllMock.mockReset();
  findGroupUserMock.mockReset();
  createRegMock.mockReset();
  findUserMock.mockReset();
  findRegMock.mockReset();
  destroyMock.mockReset();
  findRoleMock.mockReset();
  countMock.mockReset();
  sendRegEmailMock.mockClear();
  sendCancelEmailMock.mockClear();
  sendSelfCancelEmailMock.mockClear();
  sendRoleChangedEmailMock.mockClear();
  findRegMock.mockResolvedValue(null);
  findTrainingRoleMock.mockResolvedValue({ id: 'role1' });
  countMock.mockResolvedValue(0);
});

const training = {
  id: 't1',
  start_at: '2099-01-01T10:00:00Z',
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
    start_at: '2099-01-01T10:00:00Z',
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

test('unregister sends notification', async () => {
  findRegMock.mockResolvedValue({
    destroy: destroyMock,
    TrainingRole: { alias: 'PARTICIPANT' },
  });
  findTrainingMock.mockResolvedValue(training);
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.unregister('u1', 't1');
  expect(destroyMock).toHaveBeenCalled();
  expect(sendSelfCancelEmailMock).toHaveBeenCalledWith({ id: 'u1', email: 'e' }, training);
});

test('unregister rejects when deadline passed', async () => {
  const soon = { ...training, start_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString() };
  findRegMock.mockResolvedValue({
    destroy: destroyMock,
    TrainingRole: { alias: 'PARTICIPANT' },
  });
  findTrainingMock.mockResolvedValue(soon);
  await expect(service.unregister('u1', 't1')).rejects.toThrow('cancellation_deadline_passed');
});

test('unregister rejects when role not participant', async () => {
  findRegMock.mockResolvedValue({
    destroy: destroyMock,
    TrainingRole: { alias: 'COACH' },
  });
  findTrainingMock.mockResolvedValue(training);
  await expect(service.unregister('u1', 't1')).rejects.toThrow('cancellation_forbidden');
});

test('listUpcomingByUser includes my role', async () => {
  const trPlain = {
    ...training,
    TrainingRegistrations: [
      {
        user_id: 'u1',
        TrainingRole: { id: 'r1', name: 'Участник', alias: 'PARTICIPANT' },
      },
    ],
  };
  const tr = { ...trPlain, get: () => trPlain };
  findAndCountAllMock.mockResolvedValue({ rows: [tr], count: 1 });
  const res = await service.listUpcomingByUser('u1', {});
  expect(res.rows[0].my_role).toEqual({ id: 'r1', name: 'Участник', alias: 'PARTICIPANT' });
  expect(findAndCountAllMock).toHaveBeenCalled();
});

test('updatePresence updates value for admin', async () => {
  const updateMock = jest.fn();
  findRegMock.mockResolvedValueOnce({ update: updateMock });
  findUserMock.mockResolvedValueOnce({ Roles: [{ alias: 'ADMIN' }] });
  await service.updatePresence('t1', 'u1', true, 'admin');
  expect(updateMock).toHaveBeenCalledWith({ present: true, updated_by: 'admin' });
});

test('updatePresence rejects when not coach', async () => {
  findRegMock.mockResolvedValueOnce({});
  findUserMock.mockResolvedValueOnce({ Roles: [{ alias: 'REFEREE' }] });
  findRegMock.mockResolvedValueOnce(null);
  await expect(
    service.updatePresence('t1', 'u1', false, 'u2')
  ).rejects.toThrow('access_denied');
});
