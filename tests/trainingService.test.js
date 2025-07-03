import { beforeEach, expect, jest, test } from '@jest/globals';

const findByPkMock = jest.fn();
const updateMock = jest.fn();

const trainingInstance = {
  start_at: new Date('2024-01-01T10:00:00Z'),
  end_at: new Date('2024-01-01T12:00:00Z'),
  update: updateMock,
};

beforeEach(() => {
  findByPkMock.mockReset();
  updateMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Training: { findByPk: findByPkMock },
  TrainingType: {},
  CampStadium: {},
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

