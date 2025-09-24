import { beforeEach, expect, jest, test } from '@jest/globals';

const findAndCountAllMock = jest.fn();
const findByPkMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();
const bulkCreateMock = jest.fn();
const findAllGroupsMock = jest.fn();
const findOneSeasonMock = jest.fn();
const findAllCoursesMock = jest.fn();
const findUserMock = jest.fn();
const findAllUsersMock = jest.fn();
const findRegMock = jest.fn();
const findTrainingTypeMock = jest.fn();
const sendInvitationMock = jest.fn();
const trainingCourseFindAllMock = jest.fn();

const trainingInstance = {
  start_at: new Date('2024-01-01T10:00:00Z'),
  end_at: new Date('2024-01-01T12:00:00Z'),
  update: updateMock,
  ground_id: 'g1',
  season_id: 's1',
  type_id: 'tp',
  TrainingType: { for_camp: true, online: false },
};

beforeEach(() => {
  findAndCountAllMock.mockReset();
  findByPkMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  destroyMock.mockReset();
  bulkCreateMock.mockReset();
  findAllGroupsMock.mockReset();
  findOneSeasonMock.mockReset();
  findAllCoursesMock.mockReset();
  findUserMock.mockReset();
  findAllUsersMock.mockReset();
  findRegMock.mockReset();
  findTrainingTypeMock.mockReset();
  findTrainingTypeMock.mockResolvedValue({
    id: 'tp',
    for_camp: true,
    online: false,
  });
  sendInvitationMock.mockReset();
  trainingCourseFindAllMock.mockReset().mockResolvedValue([]);
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Training: {
    findAndCountAll: findAndCountAllMock,
    findByPk: findByPkMock,
    create: createMock,
  },
  TrainingType: { findByPk: findTrainingTypeMock },
  Ground: {},
  Address: {},
  Season: { findOne: findOneSeasonMock },
  TrainingRefereeGroup: { destroy: destroyMock, bulkCreate: bulkCreateMock },
  TrainingCourse: {
    destroy: destroyMock,
    bulkCreate: bulkCreateMock,
    findAll: trainingCourseFindAllMock,
  },
  Course: { findAll: findAllCoursesMock },
  User: { findByPk: findUserMock, findAll: findAllUsersMock },
  TrainingRole: {},
  Role: {},
  TrainingRegistration: { findOne: findRegMock },
  RefereeGroup: { findAll: findAllGroupsMock },
}));

jest.unstable_mockModule('../src/models/trainingRegistration.js', () => ({
  __esModule: true,
  default: { findOne: findRegMock },
}));

jest.unstable_mockModule('../src/services/emailService.js', () => ({
  __esModule: true,
  sendTrainingInvitationEmail: sendInvitationMock,
}));

const { default: service } = await import('../src/services/trainingService.js');

test('update throws on invalid time range', async () => {
  findByPkMock.mockResolvedValue({ ...trainingInstance });
  await expect(
    service.update('t1', { end_at: '2024-01-01T09:00:00Z' }, 'admin')
  ).rejects.toThrow('invalid_time_range');
});

test('update saves groups', async () => {
  findByPkMock.mockResolvedValue({ ...trainingInstance, season_id: 's1' });
  findAllGroupsMock.mockResolvedValue([
    { id: 'g1', season_id: 's1' },
    { id: 'g2', season_id: 's1' },
  ]);
  await service.update('t1', { groups: ['g1', 'g2'] }, 'admin');
  expect(destroyMock).toHaveBeenCalledWith({ where: { training_id: 't1' } });
  expect(bulkCreateMock).toHaveBeenCalledWith([
    {
      training_id: 't1',
      group_id: 'g1',
      created_by: 'admin',
      updated_by: 'admin',
    },
    {
      training_id: 't1',
      group_id: 'g2',
      created_by: 'admin',
      updated_by: 'admin',
    },
  ]);
});

test('update rejects mismatched group season', async () => {
  findByPkMock.mockResolvedValue({ ...trainingInstance, season_id: 's1' });
  findAllGroupsMock.mockResolvedValue([{ id: 'g1', season_id: 's2' }]);
  await expect(
    service.update('t1', { groups: ['g1'] }, 'admin')
  ).rejects.toThrow('invalid_group_season');
});

test('create uses provided season', async () => {
  createMock.mockResolvedValue({ id: 't1', season_id: 's1' });
  findByPkMock.mockResolvedValue({ get: () => ({ id: 't1' }) });
  await service.create(
    {
      type_id: 'tp',
      ground_id: 'g1',
      season_id: 's1',
      start_at: '2024-01-01T10:00:00Z',
      end_at: '2024-01-01T11:00:00Z',
    },
    'admin'
  );
  expect(createMock).toHaveBeenCalledWith({
    type_id: 'tp',
    ground_id: 'g1',
    season_id: 's1',
    start_at: '2024-01-01T10:00:00Z',
    end_at: '2024-01-01T11:00:00Z',
    capacity: undefined,
    url: null,
    created_by: 'admin',
    updated_by: 'admin',
  });
});

test('create derives season from groups', async () => {
  findAllGroupsMock.mockResolvedValue([{ id: 'g1', season_id: 's2' }]);
  createMock.mockResolvedValue({ id: 't2', season_id: 's2' });
  findByPkMock.mockResolvedValue({ get: () => ({ id: 't2' }) });
  await service.create(
    {
      type_id: 'tp',
      ground_id: 'g1',
      groups: ['g1'],
      start_at: '2024-01-02T10:00:00Z',
      end_at: '2024-01-02T11:00:00Z',
    },
    'admin'
  );
  expect(createMock.mock.calls[0][0].season_id).toBe('s2');
});

test('create derives season from date', async () => {
  findOneSeasonMock.mockResolvedValue({ id: 's3' });
  createMock.mockResolvedValue({ id: 't3', season_id: 's3' });
  findByPkMock.mockResolvedValue({ get: () => ({ id: 't3' }) });
  await service.create(
    {
      type_id: 'tp',
      ground_id: 'g1',
      start_at: '2025-02-01T10:00:00Z',
      end_at: '2025-02-01T12:00:00Z',
    },
    'admin'
  );
  expect(findOneSeasonMock).toHaveBeenCalledWith({ where: { alias: '2025' } });
  expect(createMock.mock.calls[0][0].season_id).toBe('s3');
});

test('create rejects mismatched group season', async () => {
  findAllGroupsMock.mockResolvedValue([
    { id: 'g1', season_id: 's2' },
    { id: 'g2', season_id: 's3' },
  ]);
  await expect(
    service.create(
      {
        type_id: 'tp',
        ground_id: 'g1',
        groups: ['g1', 'g2'],
        start_at: '2024-01-01T10:00:00Z',
        end_at: '2024-01-01T11:00:00Z',
      },
      'admin'
    )
  ).rejects.toThrow('invalid_group_season');
});

test('listAll returns trainings ordered by start date', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listAll({ page: 2, limit: 5 });
  expect(findAndCountAllMock).toHaveBeenCalledWith(
    expect.objectContaining({
      order: [['start_at', 'ASC']],
      limit: 5,
      offset: 5,
      include: expect.arrayContaining([
        expect.objectContaining({
          model: expect.anything(),
          where: { active: true },
          required: true,
        }),
      ]),
    })
  );
});

test('listAll filters trainings without course', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listAll({ course_id: 'none' });
  const args = findAndCountAllMock.mock.calls[0][0];
  expect(args.where['$Courses.id$']).toBeNull();
  const courseInclude = args.include.filter((i) => i.through)[1];
  expect(courseInclude.required).toBe(false);
});

test('listAll applies teacher filter and computes registration window', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-01-05T10:00:00Z'));
  const startAt = new Date('2024-01-10T10:00:00Z');
  const trainingRow = {
    get: () => ({
      id: 'tr1',
      start_at: startAt,
      TrainingType: { for_camp: false },
      TrainingRegistrations: [],
    }),
    start_at: startAt,
    capacity: 5,
    TrainingType: { for_camp: false },
    TrainingRegistrations: [
      { TrainingRole: { alias: 'LISTENER' } },
      { TrainingRole: { alias: 'LISTENER' } },
      { TrainingRole: { alias: 'COACH' } },
    ],
  };
  findAndCountAllMock.mockResolvedValue({ rows: [trainingRow], count: 1 });

  const result = await service.listAll({
    teacher_id: 'teacher-1',
    course_id: 'none',
    page: '2',
    limit: '5',
    forCamp: false,
  });

  const args = findAndCountAllMock.mock.calls[0][0];
  const teacherInclude = args.include.find(
    (i) => i.as === 'TeacherRegistrations'
  );
  expect(teacherInclude).toMatchObject({
    where: { user_id: 'teacher-1' },
    required: true,
  });
  expect(args.where['$Courses.id$']).toBeNull();
  expect(result.rows[0]).toMatchObject({
    registered_count: 2,
    registration_open: true,
  });
  jest.useRealTimers();
});

test('listUpcoming enforces future start filter and camp flag', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
  const startAt = new Date('2024-01-03T12:00:00Z');
  const trainingRow = {
    get: () => ({
      id: 'up1',
      start_at: startAt,
      TrainingType: { for_camp: true },
      TrainingRegistrations: [],
    }),
    start_at: startAt,
    TrainingType: { for_camp: true },
    TrainingRegistrations: [],
  };
  findAndCountAllMock.mockResolvedValue({ rows: [trainingRow], count: 1 });

  await service.listUpcoming({
    forCamp: true,
    teacher_id: 'teacher-2',
    group_id: 'g1',
    course_id: 'course-1',
    type_id: 'type-1',
  });

  const args = findAndCountAllMock.mock.calls[0][0];
  const opKeys = Object.getOwnPropertySymbols(args.where.start_at);
  expect(opKeys).toHaveLength(1);
  expect(args.where.start_at[opKeys[0]]).toBeInstanceOf(Date);
  const teacherInclude = args.include.find(
    (i) => i.as === 'TeacherRegistrations'
  );
  expect(teacherInclude).toBeDefined();
  const typeInclude = args.include.find(
    (i) => i.where && Object.prototype.hasOwnProperty.call(i.where, 'for_camp')
  );
  expect(typeInclude).toMatchObject({ where: { for_camp: true } });
  jest.useRealTimers();
});

test('listPast orders descending and flags registration closed', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-02-01T10:00:00Z'));
  const startAt = new Date('2024-01-20T08:00:00Z');
  const trainingRow = {
    get: () => ({
      id: 'past1',
      start_at: startAt,
      TrainingType: { for_camp: false },
      TrainingRegistrations: [],
    }),
    start_at: startAt,
    TrainingType: { for_camp: false },
    TrainingRegistrations: [],
  };
  findAndCountAllMock.mockResolvedValue({ rows: [trainingRow], count: 1 });

  const result = await service.listPast({
    page: 1,
    limit: 10,
    teacher_id: 'coach-3',
  });

  const args = findAndCountAllMock.mock.calls[0][0];
  expect(args.order).toEqual([['start_at', 'DESC']]);
  expect(result.rows[0].registration_open).toBe(false);
  jest.useRealTimers();
});

test('setAttendanceMarked updates for admin', async () => {
  findByPkMock.mockResolvedValue({ update: updateMock });
  findUserMock.mockResolvedValue({ Roles: [{ alias: 'ADMIN' }] });
  await service.setAttendanceMarked('t1', true, 'admin');
  expect(updateMock).toHaveBeenCalledWith({
    attendance_marked: true,
    updated_by: 'admin',
  });
});

test('setAttendanceMarked marks coach present', async () => {
  const updateRegMock = jest.fn();
  findByPkMock.mockResolvedValue({ update: updateMock });
  findUserMock.mockResolvedValue({ Roles: [{ alias: 'BRIGADE_REFEREE' }] });
  findRegMock.mockResolvedValue({
    TrainingRole: { alias: 'COACH' },
    update: updateRegMock,
  });
  await service.setAttendanceMarked('t1', true, 'u1');
  expect(updateMock).toHaveBeenCalledWith({
    attendance_marked: true,
    updated_by: 'u1',
  });
  expect(updateRegMock).toHaveBeenCalledWith({
    present: true,
    updated_by: 'u1',
  });
});

test('setAttendanceMarked rejects when not coach', async () => {
  findByPkMock.mockResolvedValue({ update: updateMock });
  findUserMock.mockResolvedValue({ Roles: [{ alias: 'BRIGADE_REFEREE' }] });
  findRegMock.mockResolvedValue(null);
  await expect(service.setAttendanceMarked('t1', true, 'u1')).rejects.toThrow(
    'access_denied'
  );
});

test('create requires ground for offline type', async () => {
  await expect(
    service.create(
      {
        type_id: 'tp',
        season_id: 's1',
        start_at: '2024-01-01T10:00:00Z',
        end_at: '2024-01-01T11:00:00Z',
      },
      'admin'
    )
  ).rejects.toThrow('ground_required');
});

test('create allows missing ground for online type', async () => {
  findTrainingTypeMock.mockResolvedValueOnce({
    id: 'tp',
    for_camp: true,
    online: true,
  });
  createMock.mockResolvedValue({ id: 't4', season_id: 's1' });
  findByPkMock.mockResolvedValue({ get: () => ({ id: 't4' }) });
  await service.create(
    {
      type_id: 'tp',
      season_id: 's1',
      start_at: '2024-01-01T10:00:00Z',
      end_at: '2024-01-01T11:00:00Z',
    },
    'admin'
  );
  expect(createMock.mock.calls[0][0].ground_id).toBeNull();
});

test('create saves url for online type', async () => {
  findTrainingTypeMock.mockResolvedValueOnce({
    id: 'tp',
    for_camp: true,
    online: true,
  });
  createMock.mockResolvedValue({ id: 't5', season_id: 's1' });
  findByPkMock.mockResolvedValue({ get: () => ({ id: 't5' }) });
  await service.create(
    {
      type_id: 'tp',
      season_id: 's1',
      start_at: '2024-01-01T10:00:00Z',
      end_at: '2024-01-01T11:00:00Z',
      url: 'https://example.com',
    },
    'admin'
  );
  expect(createMock.mock.calls[0][0].url).toBe('https://example.com');
});

test('create sends invitation email for seminar course', async () => {
  findTrainingTypeMock.mockResolvedValueOnce({
    id: 'tp',
    alias: 'SEMINAR',
    for_camp: true,
    online: false,
  });
  createMock.mockResolvedValue({ id: 't6', season_id: 's1' });
  findAllCoursesMock.mockResolvedValue([{ id: 'c1' }]);
  findAllUsersMock.mockResolvedValue([{ id: 'u1' }]);
  findByPkMock.mockResolvedValue({
    get: () => ({
      id: 't6',
      TrainingType: { alias: 'SEMINAR', name: 'Семинар', online: false },
    }),
  });
  await service.create(
    {
      type_id: 'tp',
      ground_id: 'g1',
      season_id: 's1',
      start_at: '2024-01-01T10:00:00Z',
      end_at: '2024-01-01T11:00:00Z',
      courses: ['c1'],
    },
    'admin'
  );
  expect(sendInvitationMock).toHaveBeenCalled();
});

test('isRegistrationOpen respects window and capacity', () => {
  const training = { start_at: '2024-01-15T12:00:00Z', capacity: 2 };
  jest.useFakeTimers().setSystemTime(new Date('2024-01-08T12:00:00Z'));
  expect(service.isRegistrationOpen(training, 1)).toBe(true);
  jest.setSystemTime(new Date('2024-01-07T11:59:59Z'));
  expect(service.isRegistrationOpen(training, 0)).toBe(false);
  jest.setSystemTime(new Date('2024-01-15T11:20:00Z'));
  expect(service.isRegistrationOpen(training, 0)).toBe(false);
  jest.setSystemTime(new Date('2024-01-10T12:00:00Z'));
  expect(service.isRegistrationOpen(training, 2)).toBe(false);
  jest.useRealTimers();
});
