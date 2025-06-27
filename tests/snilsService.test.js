import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();

const findExtMock = jest.fn();
const legacyFindMock = jest.fn();

const snilsInstance = { update: updateMock };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Snils: {
    findOne: findOneMock,
    create: createMock,
  },
  UserExternalId: { findOne: findExtMock },
}));
jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findById: legacyFindMock },
}));

const { default: service } = await import('../src/services/snilsService.js');

test('create throws when duplicate exists', async () => {
  findOneMock.mockResolvedValueOnce({ id: 'd' });
  await expect(service.create('u1', '123', 'a')).rejects.toThrow('snils_exists');
});

test('update throws when duplicate exists', async () => {
  findOneMock.mockResolvedValueOnce(snilsInstance); // user record
  findOneMock.mockResolvedValueOnce({ id: 'other' }); // duplicate
  await expect(service.update('u1', '123', 'a')).rejects.toThrow('snils_exists');
});

test('create stores new snils', async () => {
  findOneMock.mockResolvedValueOnce(null);
  const created = { id: 's1' };
  createMock.mockResolvedValue(created);
  const res = await service.create('u1', '111', 'a');
  expect(createMock).toHaveBeenCalledWith({
    user_id: 'u1',
    number: '111',
    created_by: 'a',
    updated_by: 'a',
  });
  expect(res).toBe(created);
});

test('update changes existing snils', async () => {
  findOneMock.mockResolvedValueOnce(snilsInstance);
  findOneMock.mockResolvedValueOnce(null);
  const res = await service.update('u1', '222', 'b');
  expect(updateMock).toHaveBeenCalledWith({ number: '222', updated_by: 'b' });
  expect(res).toBe(snilsInstance);
});

test('update throws when record missing', async () => {
  findOneMock.mockResolvedValueOnce(null);
  await expect(service.update('u1', '222', 'b')).rejects.toThrow('snils_not_found');
});

test('remove deletes snils', async () => {
  const destroyMock = jest.fn();
  findOneMock.mockResolvedValueOnce({ ...snilsInstance, destroy: destroyMock });
  await service.remove('u1');
  expect(destroyMock).toHaveBeenCalled();
});

test('remove throws when not found', async () => {
  findOneMock.mockResolvedValueOnce(null);
  await expect(service.remove('u1')).rejects.toThrow('snils_not_found');
});

test('importFromLegacy returns existing record', async () => {
  findOneMock.mockResolvedValue(snilsInstance);
  const res = await service.importFromLegacy('u1');
  expect(res).toBe(snilsInstance);
  expect(findExtMock).not.toHaveBeenCalled();
});

test('importFromLegacy creates snils from legacy data', async () => {
  findOneMock.mockReset();
  createMock.mockClear();
  findExtMock.mockClear();
  legacyFindMock.mockClear();
  findOneMock.mockResolvedValueOnce(null);
  findExtMock.mockResolvedValue({ external_id: '10' });
  legacyFindMock.mockResolvedValue({ sv_ops: '112-233-445 95' });
  const created = { id: 's2' };
  createMock.mockResolvedValue(created);
  const res = await service.importFromLegacy('u1');
  expect(createMock).toHaveBeenCalledWith({
    user_id: 'u1',
    number: '112-233-445 95',
    created_by: 'u1',
    updated_by: 'u1',
  });
  expect(res).toBe(created);
});

test('importFromLegacy returns null on invalid data', async () => {
  findOneMock.mockResolvedValueOnce(null);
  findExtMock.mockResolvedValue({ external_id: '7' });
  legacyFindMock.mockResolvedValue({ sv_ops: 'bad' });
  const res = await service.importFromLegacy('u1');
  expect(res).toBeNull();
});
