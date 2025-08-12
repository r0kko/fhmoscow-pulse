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

const courseInstance = { update: courseUpdateMock, destroy: courseDestroyMock };
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

test('removeUser destroys link when exists', async () => {
  userCourseFindOneMock.mockResolvedValue(userCourseInstance);
  await service.removeUser('u1', 'admin');
  expect(userCourseUpdateMock).toHaveBeenCalledWith({ updated_by: 'admin' });
  expect(userCourseDestroyMock).toHaveBeenCalled();
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
