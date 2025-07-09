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

test('update modifies name and capacity', async () => {
  findByPkMock.mockResolvedValue({ ...instance, name: 'Old', alias: 'old' });
  const data = { name: 'New', alias: 'old2', default_capacity: 10 };
  await service.update('t1', data, 'admin');
  expect(updateMock).toHaveBeenCalledWith(
    {
      name: 'New',
      alias: 'NEW',
      default_capacity: 10,
      updated_by: 'admin',
    },
    { returning: false }
  );
});

test('create generates alias from name', async () => {
  createMock.mockResolvedValue({});
  await service.create({ name: 'Тест', default_capacity: 5 }, 'admin');
  const arg = createMock.mock.calls[0][0];
  expect(arg.alias).toBe('TEST');
  expect(arg.created_by).toBe('admin');
});

test('remove deletes training type', async () => {
  const updateMockLocal = jest.fn();
  findByPkMock.mockResolvedValue({ ...instance, update: updateMockLocal });
  await service.remove('t1', 'admin');
  expect(updateMockLocal).toHaveBeenCalledWith({ updated_by: 'admin' });
  expect(destroyMock).toHaveBeenCalled();
});

test('remove throws when not found', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.remove('t1', 'admin')).rejects.toThrow(
    'training_type_not_found'
  );
});
