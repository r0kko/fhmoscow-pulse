import { beforeEach, expect, jest, test } from '@jest/globals';

const findAndCountAllMock = jest.fn();
const courseFindByPkMock = jest.fn();
const courseCreateMock = jest.fn();
const courseUpdateMock = jest.fn();
const courseDestroyMock = jest.fn();
const userFindByPkMock = jest.fn();
const userCourseFindOneMock = jest.fn();
const userCourseCreateMock = jest.fn();
const userCourseUpdateMock = jest.fn();
const userCourseDestroyMock = jest.fn();
const trainingCountMock = jest.fn();
const regCountMock = jest.fn();

const courseInstance = {
  id: 'c-original',
  name: 'Original Course',
  description: 'Legacy desc',
  responsible_id: 'resp-1',
  telegram_url: 'https://t.me/original',
  update: courseUpdateMock,
  destroy: courseDestroyMock,
};
const userCourseInstance = {
  update: userCourseUpdateMock,
  destroy: userCourseDestroyMock,
  restore: jest.fn(),
};

beforeEach(() => {
  findAndCountAllMock.mockReset();
  courseFindByPkMock.mockReset();
  courseCreateMock.mockReset();
  courseUpdateMock.mockReset();
  courseDestroyMock.mockReset();
  userFindByPkMock.mockReset();
  userCourseFindOneMock.mockReset();
  userCourseCreateMock.mockReset();
  userCourseUpdateMock.mockReset();
  userCourseDestroyMock.mockReset();
  userCourseInstance.restore.mockReset();
  trainingCountMock.mockReset();
  regCountMock.mockReset();
  courseUpdateMock.mockReset();
  courseDestroyMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Course: {
    findAndCountAll: findAndCountAllMock,
    findByPk: courseFindByPkMock,
    create: courseCreateMock,
  },
  User: { findByPk: userFindByPkMock },
  UserCourse: {
    findOne: userCourseFindOneMock,
    create: userCourseCreateMock,
  },
  Training: { count: trainingCountMock },
  TrainingRegistration: { count: regCountMock },
  TrainingType: {},
}));

const { default: service } = await import('../src/services/courseService.js');

test('create saves course with actor id', async () => {
  userFindByPkMock.mockResolvedValue({ id: 'u1' });
  courseCreateMock.mockResolvedValue({ id: 'c1' });
  await service.create(
    {
      name: 'Course',
      description: 'desc',
      responsible_id: 'u1',
      telegram_url: 't.me',
    },
    'admin'
  );
  expect(courseCreateMock).toHaveBeenCalledWith({
    name: 'Course',
    description: 'desc',
    responsible_id: 'u1',
    telegram_url: 't.me',
    created_by: 'admin',
    updated_by: 'admin',
  });
});

test('listAll maps pagination defaults', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listAll({ page: '0', limit: '0' });
  expect(findAndCountAllMock).toHaveBeenCalledWith({
    include: [{ model: expect.anything(), as: 'Responsible' }],
    order: [['name', 'ASC']],
    limit: 1,
    offset: 0,
  });
});

test('getById returns course with relations', async () => {
  const expected = { id: 'course-1' };
  courseFindByPkMock.mockResolvedValue(expected);
  const result = await service.getById('course-1');
  expect(courseFindByPkMock).toHaveBeenCalledWith('course-1', {
    include: [
      { model: expect.anything(), as: 'Responsible' },
      { model: expect.anything() },
    ],
  });
  expect(result).toBe(expected);
});

test('getById throws when course missing', async () => {
  courseFindByPkMock.mockResolvedValueOnce(null);
  await expect(service.getById('missing')).rejects.toThrow('course_not_found');
});

test('update merges data and returns fresh course', async () => {
  courseFindByPkMock
    .mockResolvedValueOnce({
      ...courseInstance,
      update: courseUpdateMock,
    })
    .mockResolvedValueOnce({ id: 'c1', name: 'Updated' });
  userFindByPkMock.mockResolvedValue({ id: 'resp-2' });
  await service.update(
    'c1',
    { name: 'New', responsible_id: 'resp-2', telegram_url: null },
    'actor-2'
  );
  expect(courseUpdateMock).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'New',
      description: 'Legacy desc',
      responsible_id: 'resp-2',
      telegram_url: 'https://t.me/original',
      updated_by: 'actor-2',
    }),
    { returning: false }
  );
  expect(courseFindByPkMock).toHaveBeenCalledTimes(2);
});

test('update rejects on missing course or responsible', async () => {
  courseFindByPkMock.mockResolvedValueOnce(null);
  await expect(service.update('missing', {}, 'actor')).rejects.toThrow(
    'course_not_found'
  );

  courseFindByPkMock.mockResolvedValueOnce({
    ...courseInstance,
    update: jest.fn(),
  });
  userFindByPkMock.mockResolvedValueOnce(null);
  await expect(
    service.update('c1', { responsible_id: 'not-there' }, 'actor')
  ).rejects.toThrow('user_not_found');
});

test('remove updates audit field before destroy', async () => {
  courseFindByPkMock.mockResolvedValueOnce(courseInstance);
  await service.remove('c1', 'actor-3');
  expect(courseUpdateMock).toHaveBeenCalledWith({ updated_by: 'actor-3' });
  expect(courseDestroyMock).toHaveBeenCalled();
});

test('remove throws when course missing', async () => {
  courseFindByPkMock.mockResolvedValueOnce(null);
  await expect(service.remove('absent')).rejects.toThrow('course_not_found');
});

test('setUserCourse creates new link', async () => {
  userFindByPkMock.mockResolvedValue({ id: 'u1' });
  courseFindByPkMock.mockResolvedValue(courseInstance);
  userCourseFindOneMock.mockResolvedValue(null);
  userCourseCreateMock.mockResolvedValue({});
  await service.setUserCourse('u1', 'c1', 'admin');
  expect(userCourseCreateMock).toHaveBeenCalledWith({
    user_id: 'u1',
    course_id: 'c1',
    created_by: 'admin',
    updated_by: 'admin',
  });
});

test('setUserCourse updates existing link and restores when soft-deleted', async () => {
  userFindByPkMock.mockResolvedValue({ id: 'u1' });
  courseFindByPkMock.mockResolvedValue(courseInstance);
  const restoreSpy = jest.fn();
  userCourseFindOneMock.mockResolvedValueOnce({
    ...userCourseInstance,
    deletedAt: new Date(),
    restore: restoreSpy,
  });
  await service.setUserCourse('u1', 'c2', 'actor');
  expect(restoreSpy).toHaveBeenCalled();
  expect(userCourseUpdateMock).toHaveBeenCalledWith({
    course_id: 'c2',
    updated_by: 'actor',
  });
});

test('setUserCourse throws when user or course missing', async () => {
  userFindByPkMock.mockResolvedValueOnce(null);
  await expect(service.setUserCourse('u1', 'c1', 'actor')).rejects.toThrow(
    'user_not_found'
  );

  userFindByPkMock.mockResolvedValueOnce({ id: 'u1' });
  courseFindByPkMock.mockResolvedValueOnce(null);
  await expect(service.setUserCourse('u1', 'c1', 'actor')).rejects.toThrow(
    'course_not_found'
  );
});

test('removeUser destroys link when exists', async () => {
  userCourseFindOneMock.mockResolvedValue(userCourseInstance);
  await service.removeUser('u1', 'admin');
  expect(userCourseUpdateMock).toHaveBeenCalledWith({ updated_by: 'admin' });
  expect(userCourseDestroyMock).toHaveBeenCalled();
});

test('removeUser no-ops when link missing', async () => {
  userCourseFindOneMock.mockResolvedValueOnce(null);
  await service.removeUser('u1');
  expect(userCourseUpdateMock).not.toHaveBeenCalled();
});

test('getTrainingStats filters past non-camp trainings', async () => {
  regCountMock.mockResolvedValue(1);
  trainingCountMock.mockResolvedValue(2);
  await service.getTrainingStats('u1', 'c1');
  const regCall = regCountMock.mock.calls[0][0];
  const regInclude = regCall.include[0].include;
  expect(regInclude.some((i) => i.where?.for_camp === false)).toBe(true);
  expect(regCall.include[0].where).toHaveProperty('start_at');
  const totalInclude = trainingCountMock.mock.calls[0][0].include;
  expect(totalInclude.some((i) => i.where?.for_camp === false)).toBe(true);
});

test('getUserWithCourse returns user and course data', async () => {
  userFindByPkMock.mockResolvedValueOnce({
    id: 'u1',
    UserCourse: { Course: { id: 'c1', name: 'Course' } },
  });
  const result = await service.getUserWithCourse('u1');
  expect(userFindByPkMock).toHaveBeenCalledWith('u1', {
    include: expect.any(Array),
  });
  expect(result.course).toEqual({ id: 'c1', name: 'Course' });
});

test('getUserWithCourse throws on missing user', async () => {
  userFindByPkMock.mockResolvedValueOnce(null);
  await expect(service.getUserWithCourse('missing')).rejects.toThrow(
    'user_not_found'
  );
});
