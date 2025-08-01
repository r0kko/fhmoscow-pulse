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

const { default: service } = await import(
  '../src/services/trainingTypeService.js'
);

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

test('listAll forwards pagination params', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  const result = await service.listAll({ page: 2, limit: 5 });
  expect(result).toEqual({ rows: [], count: 0 });
  expect(findAndCountAllMock).toHaveBeenCalledWith({
    order: [['name', 'ASC']],
    limit: 5,
    offset: 5,
  });
});

test('getById returns type when found', async () => {
  const type = { id: 't1' };
  findByPkMock.mockResolvedValue(type);
  const result = await service.getById('t1');
  expect(result).toBe(type);
});

test('getById throws when not found', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.getById('bad')).rejects.toThrow(
    'training_type_not_found'
  );
});

test('update keeps existing name when not provided', async () => {
  findByPkMock.mockResolvedValue({ ...instance, name: 'Old', alias: 'OLD' });
  await service.update('t1', { default_capacity: 15 }, 'admin');
  expect(updateMock).toHaveBeenCalledWith(
    {
      name: 'Old',
      alias: 'OLD',
      default_capacity: 15,
      updated_by: 'admin',
    },
    { returning: false }
  );
});

test('update throws when not found', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.update('t1', { name: 'X' }, 'admin')).rejects.toThrow(
    'training_type_not_found'
  );
});
