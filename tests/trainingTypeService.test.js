import { beforeEach, expect, jest, test } from '@jest/globals';

const findAndCountAllMock = jest.fn();
const findByPkMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();

const instance = { update: updateMock, destroy: destroyMock };

beforeEach(() => {
  findAndCountAllMock.mockReset();
  findByPkMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  destroyMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  TrainingType: {
    findAndCountAll: findAndCountAllMock,
    findByPk: findByPkMock,
    create: createMock,
  },
}));

const { default: service } = await import('../src/services/trainingTypeService.js');

test('update ignores name changes', async () => {
  findByPkMock.mockResolvedValue({ ...instance, name: 'Old', alias: 'old' });
  const data = { name: 'New', alias: 'old2', default_capacity: 10 };
  await service.update('t1', data, 'admin');
  expect(updateMock).toHaveBeenCalledWith(
    {
      alias: 'old2',
      default_capacity: 10,
      updated_by: 'admin',
    },
    { returning: false }
  );
});
