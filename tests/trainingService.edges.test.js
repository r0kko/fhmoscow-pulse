import { beforeEach, expect, jest, test, describe } from '@jest/globals';

const trainingFindByPkMock = jest.fn();
const trainingCreateMock = jest.fn();
const trainingUpdateMock = jest.fn();
const trFindOneMock = jest.fn();

const trainingTypeFindByPkMock = jest.fn();
const seasonFindOneMock = jest.fn();
const groupFindAllMock = jest.fn();
const courseFindAllMock = jest.fn();

const hasAdminRoleMock = jest.fn();
const hasRefereeRoleMock = jest.fn();

jest.unstable_mockModule('../src/utils/roles.js', () => ({
  __esModule: true,
  hasAdminRole: (...args) => hasAdminRoleMock(...args),
  hasRefereeRole: (...args) => hasRefereeRoleMock(...args),
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Training: {
    findByPk: trainingFindByPkMock,
    create: trainingCreateMock,
  },
  TrainingType: { findByPk: trainingTypeFindByPkMock },
  Season: { findOne: seasonFindOneMock },
  RefereeGroup: { findAll: groupFindAllMock },
  TrainingRefereeGroup: { bulkCreate: jest.fn(), destroy: jest.fn() },
  Course: { findAll: courseFindAllMock },
  TrainingCourse: {
    findAll: jest.fn().mockResolvedValue([]),
    bulkCreate: jest.fn(),
    destroy: jest.fn(),
  },
  Address: {},
  Ground: {},
  User: { findByPk: jest.fn() },
  TrainingRole: {},
  Role: {},
}));

jest.unstable_mockModule('../src/models/trainingRegistration.js', () => ({
  __esModule: true,
  default: { findOne: trFindOneMock },
}));

const { default: service } = await import('../src/services/trainingService.js');

beforeEach(() => {
  trainingFindByPkMock.mockReset();
  trainingCreateMock.mockReset();
  trainingUpdateMock.mockReset();
  trFindOneMock.mockReset();
  trainingTypeFindByPkMock.mockReset();
  seasonFindOneMock.mockReset();
  groupFindAllMock.mockReset();
  courseFindAllMock.mockReset();
  hasAdminRoleMock.mockReset();
  hasRefereeRoleMock.mockReset();
});

describe('trainingService create/update guards', () => {
  test('create denies when forCamp mismatches type', async () => {
    trainingTypeFindByPkMock.mockResolvedValue({
      id: 'tt',
      for_camp: false,
      online: false,
    });
    await expect(
      service.create(
        {
          type_id: 'tt',
          start_at: '2025-01-01T10:00:00Z',
          end_at: '2025-01-01T11:00:00Z',
          ground_id: 'g1',
        },
        'actor',
        true
      )
    ).rejects.toMatchObject({ code: 'access_denied' });
  });

  test('create requires ground when type is offline', async () => {
    trainingTypeFindByPkMock.mockResolvedValue({
      id: 'tt',
      for_camp: false,
      online: false,
    });
    await expect(
      service.create(
        {
          type_id: 'tt',
          start_at: '2025-01-01T10:00:00Z',
          end_at: '2025-01-01T11:00:00Z',
        },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'ground_required' });
  });

  test('create fails with invalid_group_season when groups from different seasons and no season_id provided', async () => {
    trainingTypeFindByPkMock.mockResolvedValue({
      id: 'tt',
      for_camp: false,
      online: true,
    });
    groupFindAllMock.mockResolvedValue([
      { id: 'g1', season_id: 2024 },
      { id: 'g2', season_id: 2025 },
    ]);
    await expect(
      service.create(
        {
          type_id: 'tt',
          url: 'http://x',
          start_at: '2025-01-01T10:00:00Z',
          end_at: '2025-01-01T11:00:00Z',
          groups: ['g1', 'g2'],
        },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'invalid_group_season' });
  });

  test('update rejects invalid_time_range', async () => {
    // current training
    trainingFindByPkMock.mockResolvedValue({
      id: 'tr1',
      start_at: '2025-01-01T10:00:00Z',
      end_at: '2025-01-01T11:00:00Z',
      update: trainingUpdateMock,
      TrainingType: { online: true, for_camp: false },
      type_id: 'old',
      season_id: 2025,
    });
    await expect(
      service.update(
        'tr1',
        { start_at: '2025-02-01T10:00:00Z', end_at: '2025-02-01T09:59:00Z' },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'invalid_time_range' });
  });
});

describe('trainingService setAttendanceMarked guards', () => {
  test('denies when actor neither admin nor coach/referee', async () => {
    trainingFindByPkMock.mockResolvedValue({
      id: 'tr1',
      TrainingType: { for_camp: false },
    });
    hasAdminRoleMock.mockReturnValue(false);
    hasRefereeRoleMock.mockReturnValue(false);
    // No user found -> 404 path covered
    await expect(
      service.setAttendanceMarked('tr1', true, 'actor')
    ).rejects.toMatchObject({ code: 'user_not_found' });
    expect(trFindOneMock).not.toHaveBeenCalled();
  });
});
