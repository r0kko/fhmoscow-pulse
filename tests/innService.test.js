import { expect, jest, test } from '@jest/globals';

const findOneMock = jest.fn();
const createMock = jest.fn();
const updateMock = jest.fn();

const findExtMock = jest.fn();
const legacyFindMock = jest.fn();

const innInstance = { update: updateMock };

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Inn: {
    findOne: findOneMock,
    create: createMock,
  },
  UserExternalId: { findOne: findExtMock },
}));
jest.unstable_mockModule('../src/services/legacyUserService.js', () => ({
  __esModule: true,
  default: { findById: legacyFindMock },
}));
jest.unstable_mockModule('../src/services/taxationService.js', () => ({
  __esModule: true,
  default: { removeByUser: jest.fn() },
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
  await expect(service.update('u1', '456', 'b')).rejects.toThrow('inn_not_found');
});

test('remove destroys record and taxation removed', async () => {
  const destroyMock = jest.fn();
  findOneMock.mockResolvedValueOnce({ ...innInstance, destroy: destroyMock });
  const taxation = await import('../src/services/taxationService.js');
  await service.remove('u1');
  expect(destroyMock).toHaveBeenCalled();
  expect(taxation.default.removeByUser).toHaveBeenCalledWith('u1');
});

test('remove throws when record not found', async () => {
  findOneMock.mockResolvedValueOnce(null);
  await expect(service.remove('u1')).rejects.toThrow('inn_not_found');
});

test('importFromLegacy returns existing record', async () => {
  findOneMock.mockResolvedValue(innInstance);
  const res = await service.importFromLegacy('u1');
  expect(res).toBe(innInstance);
  expect(findExtMock).not.toHaveBeenCalled();
});

test('importFromLegacy creates inn from legacy data', async () => {
  findOneMock.mockReset();
  createMock.mockClear();
  findExtMock.mockClear();
  legacyFindMock.mockClear();
  findOneMock.mockResolvedValueOnce(null); // check existing
  findExtMock.mockResolvedValue({ external_id: '5' });
  legacyFindMock.mockResolvedValue({ sv_inn: '500100732259' });
  const created = { id: 'n2' };
  createMock.mockResolvedValue(created);

  const res = await service.importFromLegacy('u1');
  expect(createMock).toHaveBeenCalledWith({
    user_id: 'u1',
    number: '500100732259',
    created_by: 'u1',
    updated_by: 'u1',
  });
  expect(res).toBe(created);
});

test('importFromLegacy returns null on invalid data', async () => {
  findOneMock.mockResolvedValueOnce(null);
  findExtMock.mockResolvedValue({ external_id: '7' });
  legacyFindMock.mockResolvedValue({ sv_inn: 'bad' });
  const res = await service.importFromLegacy('u1');
  expect(res).toBeNull();
});
