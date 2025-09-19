import { expect, jest, test } from '@jest/globals';

const ServiceError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};

async function loadServiceWithMocks(factory) {
  await jest.isolateModulesAsync(async () => {
    const {
      courseMocks,
      userMocks,
      userCourseMocks,
      trainingMocks,
      trainingRegMocks,
      extras,
    } = factory();

    jest.unstable_mockModule('../src/errors/ServiceError.js', () => ({
      __esModule: true,
      default: ServiceError,
    }));

    jest.unstable_mockModule('../src/models/index.js', () => ({
      __esModule: true,
      Course: courseMocks,
      User: userMocks,
      UserCourse: userCourseMocks,
      Training: trainingMocks,
      TrainingRegistration: trainingRegMocks,
      TrainingType: {},
      Season: { findByPk: jest.fn() },
      NormativeResult: {},
      NormativeType: {},
    }));

    const { default: service } = await import(
      '../src/services/courseService.js'
    );
    await extras(service, {
      courseMocks,
      userMocks,
      userCourseMocks,
      trainingMocks,
      trainingRegMocks,
    });
  });
}

test('courseService end-to-end coverage', async () => {
  await loadServiceWithMocks(() => {
    const courseUpdateMock = jest.fn().mockResolvedValue();
    const courseDestroyMock = jest.fn().mockResolvedValue();
    const courseFindByPk = jest
      .fn()
      .mockResolvedValueOnce({ id: 'c1', Responsible: {}, Users: [] }) // getById
      .mockResolvedValueOnce({
        id: 'c1',
        name: 'Legacy',
        description: 'Desc',
        responsible_id: 'resp-1',
        telegram_url: 'https://t.me/legacy',
        update: courseUpdateMock,
      })
      .mockResolvedValueOnce({ id: 'c1', name: 'Updated' }) // getById inside update
      .mockResolvedValueOnce({
        id: 'c1',
        update: courseUpdateMock,
        destroy: courseDestroyMock,
      })
      .mockResolvedValueOnce({ id: 'c1', Responsible: {}, Users: [] }); // fallback for setUserCourse

    const courseMocks = {
      findAndCountAll: jest
        .fn()
        .mockResolvedValue({ rows: [{ id: 'c1' }], count: 1 }),
      findByPk: courseFindByPk,
      create: jest.fn().mockResolvedValue({ id: 'c-new' }),
    };

    const userMocks = {
      findByPk: jest
        .fn()
        .mockResolvedValueOnce({ id: 'resp-1' })
        .mockResolvedValueOnce({ id: 'resp-2' })
        .mockResolvedValueOnce({ id: 'user-1' })
        .mockResolvedValueOnce({
          id: 'user-1',
          UserCourse: { Course: { id: 'c1', name: 'Updated' } },
        }),
    };

    const userCourseMocks = {
      findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        update: jest.fn(),
        destroy: jest.fn(),
      }),
      create: jest.fn().mockResolvedValue({ id: 'link-1' }),
    };

    const trainingRegMocks = {
      findOne: jest.fn().mockResolvedValueOnce(null),
      create: jest.fn().mockResolvedValue({ id: 'reg-1' }),
      count: jest.fn().mockResolvedValue(1),
    };

    const trainingMocks = {
      count: jest.fn().mockResolvedValue(4),
    };

    const extras = async (service) => {
      await service.listAll({ page: '2', limit: '4' });
      await expect(service.getById('c1')).resolves.toEqual({
        id: 'c1',
        Responsible: {},
        Users: [],
      });
      await service.create(
        {
          name: 'New Course',
          description: 'Desc',
          responsible_id: 'resp-1',
          telegram_url: 'https://t.me/course',
        },
        'actor'
      );
      await service.update(
        'c1',
        { name: 'Updated', responsible_id: 'resp-2' },
        'actor'
      );
      await service.remove('c1', 'actor');
      await service.setUserCourse('user-1', 'c1', 'actor');
      await service.removeUser('user-1', 'actor');
      await expect(service.getUserWithCourse('user-1')).resolves.toEqual({
        user: {
          id: 'user-1',
          UserCourse: { Course: { id: 'c1', name: 'Updated' } },
        },
        course: { id: 'c1', name: 'Updated' },
      });
      await service.getTrainingStats('user-1', 'c1');
    };

    return {
      courseMocks,
      userMocks,
      userCourseMocks,
      trainingMocks,
      trainingRegMocks,
      extras,
    };
  });

  await loadServiceWithMocks(() => {
    const courseMocks = {
      findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
      findByPk: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    };
    const userMocks = { findByPk: jest.fn().mockResolvedValue(null) };
    const userCourseMocks = { findOne: jest.fn(), create: jest.fn() };
    const trainingMocks = { count: jest.fn() };
    const trainingRegMocks = {
      findOne: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    };

    const extras = async (service) => {
      await expect(service.getById('absent')).rejects.toThrow(
        'course_not_found'
      );
      await expect(service.update('missing', {}, 'actor')).rejects.toThrow(
        'course_not_found'
      );
      await expect(
        service.create({ name: 'X', responsible_id: 'missing' }, 'actor')
      ).rejects.toThrow('user_not_found');
      await expect(
        service.setUserCourse('user-1', 'c1', 'actor')
      ).rejects.toThrow('user_not_found');
    };

    return {
      courseMocks,
      userMocks,
      userCourseMocks,
      trainingMocks,
      trainingRegMocks,
      extras,
    };
  });
});
