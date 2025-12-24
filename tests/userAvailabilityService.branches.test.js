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

const svcPath = '../src/services/userAvailabilityService.js';

beforeEach(() => {
  jest.resetModules();
  findAllMock.mockReset();
  findOrCreateMock.mockReset();
  userFindMock.mockReset();
  availabilityTypeFindAllMock.mockReset();
});

test('listForUsers returns [] for empty input', async () => {
  const { listForUsers } = await import(svcPath);
  const res = await listForUsers([], '2025-01-01', '2025-01-31');
  expect(res).toEqual([]);
});

test('listForUsers queries when ids provided', async () => {
  findAllMock.mockResolvedValueOnce([{ id: 1 }]);
  const { listForUsers } = await import(svcPath);
  const res = await listForUsers(['u1', 'u2'], '2025-01-01', '2025-01-31');
  expect(Array.isArray(res)).toBe(true);
  expect(findAllMock).toHaveBeenCalled();
});

test('setForUser enforces fullyLocked and within96h policy', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2025-01-05T08:00:00Z'));
  userFindMock.mockResolvedValue({});
  availabilityTypeFindAllMock.mockResolvedValue([
    { id: 'free-id', alias: 'FREE' },
    { id: 'partial-id', alias: 'PARTIAL' },
  ]);
  const service = (await import(svcPath)).default;
  await expect(
    service.setForUser(
      'u1',
      [{ date: '2025-01-05', status: 'PARTIAL', from_time: '10:00' }],
      'actor',
      { enforcePolicy: true }
    )
  ).rejects.toThrow('availability_day_locked');

  // 48h within the 96h limited window (Moscow +03:00 considered)
  await expect(
    service.setForUser(
      'u1',
      [{ date: '2025-01-07', status: 'PARTIAL', from_time: '10:00' }],
      'actor',
      { enforcePolicy: true }
    )
  ).rejects.toThrow('availability_limited_96h');
  jest.useRealTimers();
});

test('setForUser validates PARTIAL time bounds', async () => {
  userFindMock.mockResolvedValue({});
  availabilityTypeFindAllMock.mockResolvedValue([
    { id: 'partial-id', alias: 'PARTIAL' },
  ]);
  const service = (await import(svcPath)).default;
  // none provided -> invalid
  await expect(
    service.setForUser(
      'u',
      [
        {
          date: '2025-02-01',
          status: 'PARTIAL',
        },
      ],
      'actor'
    )
  ).rejects.toThrow('invalid_partial_time');
  // invalid window (from >= to)
  await expect(
    service.setForUser(
      'u',
      [
        {
          date: '2025-02-01',
          status: 'PARTIAL',
          from_time: '18:00',
          to_time: '10:00',
        },
      ],
      'actor'
    )
  ).rejects.toThrow('invalid_partial_time');
  // mode mismatch
  await expect(
    service.setForUser(
      'u',
      [
        {
          date: '2025-02-01',
          status: 'PARTIAL',
          partial_mode: 'BEFORE',
          from_time: '10:00',
        },
      ],
      'actor'
    )
  ).rejects.toThrow('invalid_partial_time');
  // invalid split (to >= from)
  await expect(
    service.setForUser(
      'u',
      [
        {
          date: '2025-02-02',
          status: 'PARTIAL',
          partial_mode: 'SPLIT',
          from_time: '10:00',
          to_time: '14:00',
        },
      ],
      'actor'
    )
  ).rejects.toThrow('invalid_partial_time');
});

test('getAvailabilityLocks returns expected flags far in future', async () => {
  const { getAvailabilityLocks } = await import(svcPath);
  jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z'));
  const r = getAvailabilityLocks('2025-02-15');
  expect(r.fullyLocked).toBe(false);
  expect(r.within96h).toBe(false);
  expect(r.limitedLocked).toBe(false);
  jest.useRealTimers();
});
