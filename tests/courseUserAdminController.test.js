import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const listUsersAllMock = jest.fn();
const getTrainingStatsMock = jest.fn();

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: {
    listUsersAll: listUsersAllMock,
  },
}));

jest.unstable_mockModule('../src/services/courseService.js', () => ({
  __esModule: true,
  default: {
    getTrainingStats: getTrainingStatsMock,
  },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: {
    toPublic: (u) => ({ id: u.id }),
  },
}));

jest.unstable_mockModule('../src/mappers/courseMapper.js', () => ({
  __esModule: true,
  default: {
    toPublic: (c) => (c ? { id: c.id } : null),
  },
}));

const { default: controller } =
  await import('../src/controllers/courseUserAdminController.js');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe('courseUserAdminController', () => {
  beforeEach(() => {
    listUsersAllMock.mockReset();
    getTrainingStatsMock.mockReset();
  });

  test('listAll uses listUsersAll and returns more than 100 users', async () => {
    const rows = Array.from({ length: 137 }, (_, i) => ({
      id: `u-${i + 1}`,
      UserCourse: null,
    }));
    listUsersAllMock.mockResolvedValue({ rows, count: rows.length });

    const req = {
      query: {
        search: 'Судья',
        role: ['REFEREE', 'BRIGADE_REFEREE'],
      },
    };
    const res = mockRes();

    await controller.listAll(req, res);

    expect(listUsersAllMock).toHaveBeenCalledWith({
      search: 'Судья',
      role: ['REFEREE', 'BRIGADE_REFEREE'],
      includeCourse: true,
    });
    const payload = res.json.mock.calls[0][0];
    expect(payload.users).toHaveLength(137);
    expect(payload.users[0]).toMatchObject({
      user: { id: 'u-1' },
      course: null,
      training_stats: { visited: 0, total: 0 },
    });
  });
});
