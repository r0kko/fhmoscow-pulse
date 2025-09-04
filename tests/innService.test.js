import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();

const innInstance = { update: updateMock };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Inn: {
    findOne: findOneMock,
    create: createMock,
  },
}));
const removeByUserMock = jest.fn();
jest.unstable_mockModule('../src/services/taxationService.js', () => ({
  __esModule: true,
  default: { removeByUser: removeByUserMock },
}));

const { default: service } = await import('../src/services/innService.js');

test('create throws when duplicate exists', async () => {
  findOneMock.mockResolvedValueOnce({ id: 'd' });
  await expect(service.create('u1', '123', 'a')).rejects.toThrow('inn_exists');
});

test('update throws when duplicate exists', async () => {
  findOneMock.mockResolvedValueOnce(innInstance); // first call for user record
  findOneMock.mockResolvedValueOnce({ id: 'other' }); // second call duplicate
  await expect(service.update('u1', '123', 'a')).rejects.toThrow('inn_exists');
});

test('create inserts new record', async () => {
  findOneMock.mockResolvedValueOnce(null);
  const created = { id: 'n1' };
  createMock.mockResolvedValue(created);
  const res = await service.create('u1', '123', 'a');
  expect(createMock).toHaveBeenCalledWith({
    user_id: 'u1',
    number: '123',
    created_by: 'a',
    updated_by: 'a',
  });
  expect(res).toBe(created);
});

test('update modifies existing record', async () => {
  findOneMock.mockResolvedValueOnce(innInstance); // user record
  findOneMock.mockResolvedValueOnce(null); // no duplicate
  const res = await service.update('u1', '456', 'b');
  expect(updateMock).toHaveBeenCalledWith({ number: '456', updated_by: 'b' });
  expect(res).toBe(innInstance);
});

test('update throws when record missing', async () => {
  findOneMock.mockResolvedValueOnce(null); // user record missing
  await expect(service.update('u1', '456', 'b')).rejects.toThrow(
    'inn_not_found'
  );
});

test('remove destroys record and taxation removed', async () => {
  const destroyMock = jest.fn();
  const updateMockLocal = jest.fn();
  findOneMock.mockResolvedValueOnce({
    ...innInstance,
    destroy: destroyMock,
    update: updateMockLocal,
  });
  await service.remove('u1', 'admin');
  expect(updateMockLocal).toHaveBeenCalledWith({ updated_by: 'admin' });
  expect(destroyMock).toHaveBeenCalled();
  expect(removeByUserMock).toHaveBeenCalledWith('u1');
});

test('remove throws when record not found', async () => {
  findOneMock.mockResolvedValueOnce(null);
  await expect(service.remove('u1', 'admin')).rejects.toThrow('inn_not_found');
});
