import { beforeEach, expect, jest, test } from '@jest/globals';

const findTrainingMock = jest.fn();
const findAndCountAllMock = jest.fn();
const findGroupUserMock = jest.fn();
const findCourseLinkMock = jest.fn();
const createRegMock = jest.fn();
const findUserMock = jest.fn();
const findRegMock = jest.fn();
const destroyMock = jest.fn();
const findTrainingRoleMock = jest.fn();
const findRoleMock = jest.fn();
const countMock = jest.fn();
const updateTrainingMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Training: {
    findByPk: findTrainingMock,
    findAndCountAll: findAndCountAllMock,
  },
  TrainingType: {},
  Ground: {},
  Season: {},
  RefereeGroup: {},
  Address: {},
  TrainingRole: {
    findOne: findTrainingRoleMock,
    findByPk: findTrainingRoleMock,
  },
  RefereeGroupUser: { findOne: findGroupUserMock },
  Course: {},
  UserCourse: { findOne: findCourseLinkMock },
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

const { default: service } = await import(
  '../src/services/trainingRegistrationService.js'
);

beforeEach(() => {
  findTrainingMock.mockReset();
  findAndCountAllMock.mockReset();
  findGroupUserMock.mockReset();
  findCourseLinkMock.mockReset();
  createRegMock.mockReset();
  findUserMock.mockReset();
  findRegMock.mockReset();
  destroyMock.mockReset();
  findTrainingRoleMock.mockReset();
  findRoleMock.mockReset();
  countMock.mockReset();
  updateTrainingMock.mockReset();
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
  TrainingType: { for_camp: true },
  update: updateTrainingMock,
  get() {
    return this;
  },
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
    { id: 'role1' },
    false
  );
  expect(updateTrainingMock).toHaveBeenCalledWith({
    attendance_marked: false,
    updated_by: 'u1',
  });
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
  expect(updateMock).toHaveBeenCalledWith({
    training_role_id: 'role1',
    updated_by: 'u1',
  });
  expect(createRegMock).not.toHaveBeenCalled();
  expect(sendRegEmailMock).toHaveBeenCalled();
  expect(updateTrainingMock).toHaveBeenCalledWith({
    attendance_marked: false,
    updated_by: 'u1',
  });
});

test('remove sends cancellation email', async () => {
  const updateMock = jest.fn();
  findRegMock.mockResolvedValue({ destroy: destroyMock, update: updateMock });
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  findTrainingMock.mockResolvedValue(training);
  await service.remove('t1', 'u1', 'admin');
  expect(updateMock).toHaveBeenCalledWith({ updated_by: 'admin' });
  expect(destroyMock).toHaveBeenCalled();
  expect(sendCancelEmailMock).toHaveBeenCalledWith(
    { id: 'u1', email: 'e' },
    training
  );
  expect(updateTrainingMock).toHaveBeenCalledWith({
    attendance_marked: false,
    updated_by: 'admin',
  });
});

test('add creates registration for referee', async () => {
  const tr = {
    ...training,
    TrainingRegistrations: [],
    update: updateTrainingMock,
  };
  findTrainingMock.mockResolvedValue(tr);
  findUserMock.mockResolvedValue({
    id: 'u2',
    email: 'e2',
    Roles: [{ alias: 'BRIGADE_REFEREE' }],
  });
  await service.add('t1', 'u2', 'role2', 'admin');
  expect(createRegMock).toHaveBeenCalledWith({
    training_id: 't1',
    user_id: 'u2',
    training_role_id: 'role2',
    created_by: 'admin',
    updated_by: 'admin',
  });
  expect(sendRegEmailMock).toHaveBeenCalledWith(
    { id: 'u2', email: 'e2', Roles: [{ alias: 'BRIGADE_REFEREE' }] },
    tr,
    { id: 'role1' },
    true
  );
  expect(updateTrainingMock).toHaveBeenCalledWith({
    attendance_marked: false,
    updated_by: 'admin',
  });
});

test('register for course uses listener role', async () => {
  const courseTraining = {
    id: 't1',
    start_at: '2099-01-01T10:00:00Z',
    RefereeGroups: [],
    Courses: [{ id: 'c1' }],
    TrainingRegistrations: [],
    TrainingType: { for_camp: false },
    update: updateTrainingMock,
    get() {
      return this;
    },
  };
  findTrainingMock.mockResolvedValue(courseTraining);
  findCourseLinkMock.mockResolvedValue({ user_id: 'u1', course_id: 'c1' });
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.register('u1', 't1', 'u1', false);
  expect(findTrainingRoleMock).toHaveBeenCalledWith({
    where: { alias: 'LISTENER' },
  });
});

test('add assigns listener role for course', async () => {
  const tr = {
    id: 't1',
    start_at: '2099-01-01T10:00:00Z',
    RefereeGroups: [],
    TrainingRegistrations: [],
    TrainingType: { for_camp: false },
    update: updateTrainingMock,
    get() {
      return this;
    },
  };
  findTrainingMock.mockResolvedValue(tr);
  findUserMock.mockResolvedValue({
    id: 'u2',
    email: 'e2',
    Roles: [{ alias: 'BRIGADE_REFEREE' }],
  });
  findTrainingRoleMock
    .mockResolvedValueOnce({ id: 'role2', alias: 'PARTICIPANT' })
    .mockResolvedValueOnce({ id: 'listener', alias: 'LISTENER' });
  await service.add('t1', 'u2', 'role2', 'admin');
  expect(createRegMock).toHaveBeenCalledWith({
    training_id: 't1',
    user_id: 'u2',
    training_role_id: 'listener',
    created_by: 'admin',
    updated_by: 'admin',
  });
});

test('add restores deleted registration', async () => {
  const tr = {
    ...training,
    TrainingRegistrations: [],
    update: updateTrainingMock,
  };
  const restoreMock = jest.fn();
  const updateMock = jest.fn();
  findTrainingMock.mockResolvedValue(tr);
  findUserMock.mockResolvedValue({
    id: 'u2',
    email: 'e2',
    Roles: [{ alias: 'BRIGADE_REFEREE' }],
  });
  findRegMock.mockResolvedValue({
    deletedAt: new Date(),
    restore: restoreMock,
    update: updateMock,
  });
  await service.add('t1', 'u2', 'role2', 'admin');
  expect(restoreMock).toHaveBeenCalled();
  expect(updateMock).toHaveBeenCalledWith({
    training_role_id: 'role2',
    updated_by: 'admin',
  });
  expect(createRegMock).not.toHaveBeenCalled();
  expect(sendRegEmailMock).toHaveBeenCalledWith(
    { id: 'u2', email: 'e2', Roles: [{ alias: 'BRIGADE_REFEREE' }] },
    tr,
    { id: 'role1' },
    true
  );
  expect(updateTrainingMock).toHaveBeenCalledWith({
    attendance_marked: false,
    updated_by: 'admin',
  });
});

test('add replaces existing teacher', async () => {
  const oldDestroy = jest.fn();
  const tr = {
    ...training,
    TrainingType: { for_camp: false },
    TrainingRegistrations: [
      {
        user_id: 'uOld',
        TrainingRole: { alias: 'TEACHER' },
        destroy: oldDestroy,
      },
    ],
    update: updateTrainingMock,
  };
  findTrainingMock.mockResolvedValue(tr);
  findUserMock.mockResolvedValue({
    id: 'uNew',
    email: 'eNew',
    Roles: [{ alias: 'BRIGADE_REFEREE' }],
  });
  findTrainingRoleMock.mockResolvedValueOnce({
    id: 'tRole',
    alias: 'TEACHER',
  });
  await service.add('t1', 'uNew', 'tRole', 'admin');
  expect(oldDestroy).toHaveBeenCalled();
  expect(createRegMock).toHaveBeenCalledWith({
    training_id: 't1',
    user_id: 'uNew',
    training_role_id: 'tRole',
    created_by: 'admin',
    updated_by: 'admin',
  });
});

test('add allows non-referee as teacher', async () => {
  findTrainingMock.mockResolvedValue({
    ...training,
    TrainingType: { for_camp: false },
    TrainingRegistrations: [],
    update: updateTrainingMock,
  });
  findUserMock.mockResolvedValue({ id: 'u3', email: 'e3', Roles: [] });
  findTrainingRoleMock.mockResolvedValueOnce({ id: 'tRole', alias: 'TEACHER' });
  await service.add('t1', 'u3', 'tRole', 'admin');
  expect(createRegMock).toHaveBeenCalledWith({
    training_id: 't1',
    user_id: 'u3',
    training_role_id: 'tRole',
    created_by: 'admin',
    updated_by: 'admin',
  });
});

test('add rejects listener for camp training', async () => {
  findTrainingMock.mockResolvedValue({
    ...training,
    TrainingRegistrations: [],
    update: updateTrainingMock,
  });
  findUserMock.mockResolvedValue({
    id: 'u4',
    email: 'e4',
    Roles: [{ alias: 'BRIGADE_REFEREE' }],
  });
  findTrainingRoleMock.mockResolvedValueOnce({ id: 'listener', alias: 'LISTENER' });
  await expect(service.add('t1', 'u4', 'listener', 'admin')).rejects.toThrow(
    'training_role_forbidden'
  );
});

test('register rejects when training is full', async () => {
  const tr = {
    id: 't1',
    start_at: '2099-01-01T10:00:00Z',
    capacity: 1,
    RefereeGroups: [{ id: 'g1' }],
    TrainingRegistrations: [{ TrainingRole: { alias: 'PARTICIPANT' } }],
    TrainingType: { for_camp: true },
    update: updateTrainingMock,
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
  expect(updateMock).toHaveBeenCalledWith({
    training_role_id: 'role3',
    updated_by: 'admin',
  });
  expect(sendRoleChangedEmailMock).toHaveBeenCalledWith(
    { id: 'u1', email: 'e' },
    training,
    { id: 'role1' },
    true
  );
  expect(updateTrainingMock).toHaveBeenCalledWith({
    attendance_marked: false,
    updated_by: 'admin',
  });
});

test('updateRole rejects teacher for camp training', async () => {
  findRegMock.mockResolvedValue({ update: jest.fn() });
  findTrainingRoleMock.mockResolvedValueOnce({ id: 'tRole', alias: 'TEACHER' });
  findTrainingMock.mockResolvedValue(training);
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await expect(service.updateRole('t1', 'u1', 'tRole', 'admin')).rejects.toThrow(
    'training_role_forbidden'
  );
});

test('unregister sends notification', async () => {
  const updateMock = jest.fn();
  findRegMock.mockResolvedValue({
    destroy: destroyMock,
    update: updateMock,
    TrainingRole: { alias: 'PARTICIPANT' },
  });
  findTrainingMock.mockResolvedValue(training);
  findUserMock.mockResolvedValue({ id: 'u1', email: 'e' });
  await service.unregister('u1', 't1', 'u1');
  expect(updateMock).toHaveBeenCalledWith({ updated_by: 'u1' });
  expect(destroyMock).toHaveBeenCalled();
  expect(sendSelfCancelEmailMock).toHaveBeenCalledWith(
    { id: 'u1', email: 'e' },
    training
  );
  expect(updateTrainingMock).toHaveBeenCalledWith({
    attendance_marked: false,
    updated_by: 'u1',
  });
});

test('unregister rejects when deadline passed', async () => {
  const soon = {
    ...training,
    start_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
  };
  findRegMock.mockResolvedValue({
    destroy: destroyMock,
    TrainingRole: { alias: 'PARTICIPANT' },
  });
  findTrainingMock.mockResolvedValue(soon);
  await expect(service.unregister('u1', 't1', 'u1')).rejects.toThrow(
    'cancellation_deadline_passed'
  );
});

test('unregister rejects when role not participant', async () => {
  findRegMock.mockResolvedValue({
    destroy: destroyMock,
    TrainingRole: { alias: 'COACH' },
  });
  findTrainingMock.mockResolvedValue(training);
  await expect(service.unregister('u1', 't1', 'u1')).rejects.toThrow(
    'cancellation_forbidden'
  );
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
  const res = await service.listUpcomingByUser('u1', {}, true);
  expect(res.rows[0].my_role).toEqual({
    id: 'r1',
    name: 'Участник',
    alias: 'PARTICIPANT',
  });
  expect(findAndCountAllMock).toHaveBeenCalled();
});

test('listUpcomingByUser excludes finished unmarked trainings', async () => {
  findAndCountAllMock.mockResolvedValueOnce({ rows: [], count: 0 });
  await service.listUpcomingByUser('u1', {}, true);
  const where = findAndCountAllMock.mock.calls[0][0].where;
  const cond = where[Object.getOwnPropertySymbols(where)[0]][1];
  expect(cond).not.toHaveProperty('attendance_marked');
  expect(cond).toHaveProperty('end_at');
});

test('listPastByUser includes my presence', async () => {
  const trPlain = {
    ...training,
    end_at: new Date(Date.now() - 1000).toISOString(),
    TrainingRegistrations: [
      {
        user_id: 'u1',
        present: true,
        TrainingRole: { id: 'r1', name: 'Участник', alias: 'PARTICIPANT' },
      },
    ],
  };
  const tr = { ...trPlain, get: () => trPlain };
  findAndCountAllMock.mockResolvedValueOnce({ rows: [tr], count: 1 });
  const res = await service.listPastByUser('u1', {}, true);
  expect(res.rows[0].my_presence).toBe(true);
});

test('listPastByUser returns unmarked trainings', async () => {
  const trPlain = {
    ...training,
    end_at: new Date(Date.now() - 1000).toISOString(),
    attendance_marked: false,
    TrainingRegistrations: [
      {
        user_id: 'u1',
        TrainingRole: { id: 'r1', name: 'Участник', alias: 'PARTICIPANT' },
      },
    ],
  };
  const tr = { ...trPlain, get: () => trPlain };
  findAndCountAllMock.mockResolvedValueOnce({ rows: [tr], count: 1 });
  const res = await service.listPastByUser('u1', {}, true);
  expect(res.rows[0].attendance_marked).toBe(false);
});

test('listPastByUser filters by course', async () => {
  findAndCountAllMock.mockResolvedValueOnce({ rows: [], count: 0 });
  await service.listPastByUser('u1', {}, false, 'c1');
  const include = findAndCountAllMock.mock.calls[0][0].include;
  expect(include.some((i) => i.where?.id === 'c1')).toBe(true);
});

test('updatePresence updates value for admin', async () => {
  const updateMock = jest.fn();
  findRegMock.mockResolvedValueOnce({ update: updateMock });
  findUserMock.mockResolvedValueOnce({ Roles: [{ alias: 'ADMIN' }] });
  await service.updatePresence('t1', 'u1', true, 'admin');
  expect(updateMock).toHaveBeenCalledWith({
    present: true,
    updated_by: 'admin',
  });
});

test('updatePresence rejects when not coach', async () => {
  findRegMock.mockResolvedValueOnce({});
  findUserMock.mockResolvedValueOnce({ Roles: [{ alias: 'BRIGADE_REFEREE' }] });
  findRegMock.mockResolvedValueOnce(null);
  await expect(service.updatePresence('t1', 'u1', false, 'u2')).rejects.toThrow(
    'access_denied'
  );
});

test('updatePresence rejects when updating coach presence', async () => {
  findRegMock.mockResolvedValueOnce({ TrainingRole: { alias: 'COACH' } });
  findUserMock.mockResolvedValueOnce({ Roles: [{ alias: 'BRIGADE_REFEREE' }] });
  findRegMock.mockResolvedValueOnce({ TrainingRole: { alias: 'COACH' } });
  await expect(service.updatePresence('t1', 'u1', true, 'u1')).rejects.toThrow(
    'access_denied'
  );
});

test('listAvailable returns empty when no referee group', async () => {
  findGroupUserMock.mockResolvedValue(null);
  const res = await service.listAvailable('u1');
  expect(res).toEqual({ rows: [], count: 0 });
});

test('listAvailableForCourse returns empty when no course', async () => {
  findCourseLinkMock.mockResolvedValue(null);
  const res = await service.listAvailableForCourse('u1');
  expect(res).toEqual({ rows: [], count: 0 });
});

test('listAvailableForCourse returns trainings', async () => {
  findCourseLinkMock.mockResolvedValue({ course_id: 'c1' });
  findAndCountAllMock.mockResolvedValue({ rows: [training], count: 1 });
  const res = await service.listAvailableForCourse('u1');
  expect(res.count).toBe(1);
  expect(res.rows[0].id).toBe('t1');
});
