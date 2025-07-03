import { beforeEach, expect, jest, test } from '@jest/globals';

const findAndCountAllMock = jest.fn();
const findByPkMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();
const bulkCreateMock = jest.fn();
const findAllGroupsMock = jest.fn();
const findOneSeasonMock = jest.fn();

const trainingInstance = {
  start_at: new Date('2024-01-01T10:00:00Z'),
  end_at: new Date('2024-01-01T12:00:00Z'),
  update: updateMock,
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
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Training: {
    findAndCountAll: findAndCountAllMock,
    findByPk: findByPkMock,
    create: createMock,
  },
  TrainingType: {},
  CampStadium: {},
  Address: {},
  Season: { findOne: findOneSeasonMock },
  TrainingRefereeGroup: { destroy: destroyMock, bulkCreate: bulkCreateMock },
  RefereeGroup: { findAll: findAllGroupsMock },
}));

const { default: service } = await import('../src/services/trainingService.js');

test('update throws on invalid time range', async () => {
  findByPkMock.mockResolvedValue({ ...trainingInstance });
  await expect(
    service.update(
      't1',
      { end_at: '2024-01-01T09:00:00Z' },
      'admin'
    )
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
      camp_stadium_id: 'c1',
      season_id: 's1',
      start_at: '2024-01-01T10:00:00Z',
      end_at: '2024-01-01T11:00:00Z',
    },
    'admin'
  );
  expect(createMock).toHaveBeenCalledWith({
    type_id: 'tp',
    camp_stadium_id: 'c1',
    season_id: 's1',
    start_at: '2024-01-01T10:00:00Z',
    end_at: '2024-01-01T11:00:00Z',
    capacity: undefined,
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
      camp_stadium_id: 'c1',
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
      camp_stadium_id: 'c1',
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
        camp_stadium_id: 'c1',
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

