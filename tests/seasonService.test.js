import { beforeEach, expect, jest, test } from '@jest/globals';

const findAndCountAllMock = jest.fn();
const findByPkMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();
const destroyMock = jest.fn();
const findOneMock = jest.fn();

beforeEach(() => {
  findAndCountAllMock.mockReset();
  findByPkMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  destroyMock.mockReset();
  findOneMock.mockReset();
});

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Season: {
    findAndCountAll: findAndCountAllMock,
    findByPk: findByPkMock,
    create: createMock,
    update: updateMock,
    findOne: findOneMock,
  },
}));

jest.unstable_mockModule('../src/utils/alias.js', () => ({
  __esModule: true,
  default: (name) => name.toUpperCase(),
}));

const { default: service } = await import('../src/services/seasonService.js');

test('listAll passes pagination options', async () => {
  findAndCountAllMock.mockResolvedValue({ rows: [], count: 0 });
  await service.listAll({ page: 2, limit: 5 });
  expect(findAndCountAllMock).toHaveBeenCalledWith({
    order: [['name', 'ASC']],
    limit: 5,
    offset: 5,
  });
});

test('getById returns season', async () => {
  findByPkMock.mockResolvedValue({ id: 's1' });
  const res = await service.getById('s1');
  expect(res).toEqual({ id: 's1' });
});

test('getById throws when missing', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.getById('s1')).rejects.toThrow('season_not_found');
});

test('create deactivates other seasons when active', async () => {
  createMock.mockResolvedValue({ id: 's2' });
  await service.create({ name: 'New', active: true }, 'admin');
  expect(updateMock).toHaveBeenCalledWith({ active: false }, { where: { active: true } });
  const arg = createMock.mock.calls[0][0];
  expect(arg.alias).toBe('NEW');
  expect(arg.created_by).toBe('admin');
});

test('update modifies existing season', async () => {
  findByPkMock.mockResolvedValue({ id: 's1', name: 'Old', alias: 'OLD', active: false, update: updateMock });
  await service.update('s1', { name: 'New', active: true }, 'admin');
  expect(updateMock).toHaveBeenCalledWith({ active: false }, { where: { active: true } });
  expect(updateMock).toHaveBeenCalledTimes(2);
});

test('remove deletes season', async () => {
  const updateMockLocal = jest.fn();
  findByPkMock.mockResolvedValue({ destroy: destroyMock, update: updateMockLocal });
  await service.remove('s1', 'admin');
  expect(updateMockLocal).toHaveBeenCalledWith({ updated_by: 'admin' });
  expect(destroyMock).toHaveBeenCalled();
});

test('remove throws when missing', async () => {
  findByPkMock.mockResolvedValue(null);
  await expect(service.remove('s1', 'admin')).rejects.toThrow('season_not_found');
});

