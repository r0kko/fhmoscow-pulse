import { beforeEach, expect, jest, test } from '@jest/globals';

const findByPkMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();
const bulkCreateMock = jest.fn();
const findAllGroupsMock = jest.fn();

const trainingInstance = {
  start_at: new Date('2024-01-01T10:00:00Z'),
  end_at: new Date('2024-01-01T12:00:00Z'),
  update: updateMock,
};

beforeEach(() => {
  findByPkMock.mockReset();
  updateMock.mockReset();
  destroyMock.mockReset();
  bulkCreateMock.mockReset();
  findAllGroupsMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Training: { findByPk: findByPkMock },
  TrainingType: {},
  CampStadium: {},
  Address: {},
  Season: {},
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

