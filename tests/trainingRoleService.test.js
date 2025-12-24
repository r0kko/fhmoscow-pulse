import { beforeEach, expect, jest, test } from '@jest/globals';

const findAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  TrainingRole: { findAll: findAllMock },
}));

const { default: service } =
  await import('../src/services/trainingRoleService.js');

beforeEach(() => {
  findAllMock.mockReset();
});

test('list forwards filter and ordering', async () => {
  findAllMock.mockResolvedValue([]);
  await service.list({ forCamp: false });
  expect(findAllMock).toHaveBeenCalledWith({
    where: { for_camp: false },
    order: [['name', 'ASC']],
  });
});

test('list without options returns all', async () => {
  findAllMock.mockResolvedValue([]);
  await service.list();
  expect(findAllMock).toHaveBeenCalledWith({
    where: {},
    order: [['name', 'ASC']],
  });
});
