import { beforeEach, expect, jest, test } from '@jest/globals';

const findAllMock = jest.fn();
const findOneMock = jest.fn();
const createMock = jest.fn();
const userFindMock = jest.fn();
const availabilityTypeFindAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  UserAvailability: {
    findAll: findAllMock,
    findOne: findOneMock,
    create: createMock,
  },
  User: { findByPk: userFindMock },
  AvailabilityType: { findAll: availabilityTypeFindAllMock },
}));

const servicePath = '../src/services/userAvailabilityService.js';

beforeEach(() => {
  jest.resetModules();
  findAllMock.mockReset();
  findOneMock.mockReset();
  createMock.mockReset();
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
  findOneMock
    .mockResolvedValueOnce({ update: updateMock })
    .mockResolvedValueOnce(null);
  createMock.mockResolvedValueOnce({ id: 'new' });
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
  expect(findOneMock).toHaveBeenCalledTimes(2);
  expect(createMock).toHaveBeenCalledTimes(1);
  expect(availabilityTypeFindAllMock).toHaveBeenCalled();
  expect(createMock.mock.calls[0][0].type_id).toBe('busy-id');
});

test('setForUser normalizes partial modes before and after', async () => {
  userFindMock.mockResolvedValue({});
  findOneMock.mockResolvedValue(null);
  createMock.mockResolvedValue({ id: 'new' });
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

  expect(findOneMock).toHaveBeenCalledTimes(5);
  expect(createMock).toHaveBeenCalledTimes(5);
  expect(createMock.mock.calls[0][0]).toMatchObject({
    from_time: null,
    to_time: '12:00',
  });
  expect(createMock.mock.calls[1][0]).toMatchObject({
    from_time: '14:00',
    to_time: null,
  });
  expect(createMock.mock.calls[2][0]).toMatchObject({
    from_time: '09:00',
    to_time: '15:00',
  });
  expect(createMock.mock.calls[3][0]).toMatchObject({
    from_time: '10:00',
    to_time: '12:00',
  });
  expect(createMock.mock.calls[4][0]).toMatchObject({
    from_time: '14:00',
    to_time: '10:00',
  });
});
