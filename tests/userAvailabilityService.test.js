import { beforeEach, expect, jest, test } from '@jest/globals';

const findAllMock = jest.fn();
const findOrCreateMock = jest.fn();
const userFindMock = jest.fn();
const availabilityTypeFindAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  UserAvailability: { findAll: findAllMock, findOrCreate: findOrCreateMock },
  User: { findByPk: userFindMock },
  AvailabilityType: { findAll: availabilityTypeFindAllMock },
}));

const servicePath = '../src/services/userAvailabilityService.js';

beforeEach(() => {
  jest.resetModules();
  findAllMock.mockReset();
  findOrCreateMock.mockReset();
  userFindMock.mockReset();
  availabilityTypeFindAllMock.mockReset();
});

test('listForUser returns records', async () => {
  findAllMock.mockResolvedValue([{ id: 1 }]);
  const service = (await import(servicePath)).default;
  const res = await service.listForUser('u', '2025-01-01', '2025-01-02');
  expect(res).toEqual([{ id: 1 }]);
  expect(findAllMock).toHaveBeenCalled();
});

test('setForUser throws when user not found', async () => {
  userFindMock.mockResolvedValue(null);
  const service = (await import(servicePath)).default;
  await expect(service.setForUser('u', [], 'a')).rejects.toThrow(
    'user_not_found'
  );
});

test('setForUser creates and updates records', async () => {
  userFindMock.mockResolvedValue({});
  const updateMock = jest.fn();
  findOrCreateMock
    .mockResolvedValueOnce([{ update: updateMock }, false])
    .mockResolvedValueOnce([{ id: 'new' }, true]);
  availabilityTypeFindAllMock.mockResolvedValue([
    { id: 'free-id', alias: 'FREE' },
    { id: 'busy-id', alias: 'BUSY' },
  ]);
  const service = (await import(servicePath)).default;
  await service.setForUser(
    'u',
    [
      { date: '2025-01-01', status: 'FREE' },
      { date: '2025-01-02', status: 'BUSY' },
    ],
    'a'
  );
  expect(updateMock).toHaveBeenCalled();
  expect(findOrCreateMock).toHaveBeenCalledTimes(2);
  expect(availabilityTypeFindAllMock).toHaveBeenCalled();
  expect(findOrCreateMock.mock.calls[0][0].defaults.type_id).toBe('free-id');
});

test('setForUser normalizes partial modes before and after', async () => {
  userFindMock.mockResolvedValue({});
  findOrCreateMock.mockResolvedValue([{ id: 'new' }, true]);
  availabilityTypeFindAllMock.mockResolvedValue([
    { id: 'partial-id', alias: 'PARTIAL' },
  ]);
  const service = (await import(servicePath)).default;
  await service.setForUser(
    'u',
    [
      {
        date: '2025-01-10',
        status: 'PARTIAL',
        partial_mode: 'BEFORE',
        to_time: '12:00',
      },
      {
        date: '2025-01-11',
        status: 'PARTIAL',
        partial_mode: 'AFTER',
        from_time: '14:00',
      },
      {
        date: '2025-01-12',
        status: 'PARTIAL',
        partial_mode: 'WINDOW',
        from_time: '09:00',
        to_time: '15:00',
      },
      {
        date: '2025-01-13',
        status: 'PARTIAL',
        from_time: '10:00',
        to_time: '12:00',
      },
      {
        date: '2025-01-14',
        status: 'PARTIAL',
        partial_mode: 'SPLIT',
        from_time: '14:00',
        to_time: '10:00',
      },
    ],
    'actor'
  );

  expect(findOrCreateMock).toHaveBeenCalledTimes(5);
  expect(findOrCreateMock.mock.calls[0][0].defaults).toMatchObject({
    from_time: null,
    to_time: '12:00',
  });
  expect(findOrCreateMock.mock.calls[1][0].defaults).toMatchObject({
    from_time: '14:00',
    to_time: null,
  });
  expect(findOrCreateMock.mock.calls[2][0].defaults).toMatchObject({
    from_time: '09:00',
    to_time: '15:00',
  });
  expect(findOrCreateMock.mock.calls[3][0].defaults).toMatchObject({
    from_time: '10:00',
    to_time: '12:00',
  });
  expect(findOrCreateMock.mock.calls[4][0].defaults).toMatchObject({
    from_time: '14:00',
    to_time: '10:00',
  });
});
