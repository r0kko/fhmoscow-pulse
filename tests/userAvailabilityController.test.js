import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const listUsersMock = jest.fn();
const getUserMock = jest.fn();
const toPublicArrayMock = jest.fn();
const toPublicMock = jest.fn();
const listForUserMock = jest.fn();
const setForUserMock = jest.fn();
const clearForUserMock = jest.fn();
const listForUsersMock = jest.fn();
const getAvailabilityLocksMock = jest.fn();

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { listUsers: listUsersMock, getUser: getUserMock },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublicArray: toPublicArrayMock, toPublic: toPublicMock },
}));

jest.unstable_mockModule('../src/services/userAvailabilityService.js', () => ({
  __esModule: true,
  default: { listForUser: listForUserMock, setForUser: setForUserMock },
  listForUsers: listForUsersMock,
  getAvailabilityLocks: getAvailabilityLocksMock,
  clearForUser: clearForUserMock,
}));

const controllerPath = '../src/controllers/userAvailabilityController.js';

beforeEach(() => {
  jest.resetModules();
  listUsersMock.mockReset();
  getUserMock.mockReset();
  toPublicArrayMock.mockReset();
  toPublicMock.mockReset();
  listForUserMock.mockReset();
  setForUserMock.mockReset();
  clearForUserMock.mockReset();
  listForUsersMock.mockReset();
  getAvailabilityLocksMock.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

test('adminGrid returns filtered dates and the full calendar metadata', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-04-01T00:00:00Z'));

  listUsersMock.mockResolvedValue({ rows: [{ id: 'u1', roles: ['REFEREE'] }] });
  toPublicArrayMock.mockReturnValue([
    {
      id: 'u1',
      last_name: 'Сидоров',
      first_name: 'Илья',
      patronymic: 'Олегович',
      roles: ['REFEREE'],
    },
  ]);
  listForUsersMock.mockResolvedValue([
    {
      user_id: 'u1',
      date: '2024-04-01',
      AvailabilityType: { alias: 'BUSY' },
      from_time: null,
      to_time: null,
    },
    {
      user_id: 'u1',
      date: '2024-04-03',
      AvailabilityType: { alias: 'PARTIAL' },
      from_time: '14:00:00',
      to_time: null,
    },
  ]);

  const controller = (await import(controllerPath)).default;
  const jsonMock = jest.fn();

  await controller.adminGrid(
    {
      query: {
        role: 'REFEREE',
        date: ['2024-04-01', '2024-04-03'],
      },
    },
    { json: jsonMock }
  );

  expect(listForUsersMock).toHaveBeenCalledWith(
    ['u1'],
    '2024-04-01',
    '2024-04-03'
  );

  const payload = jsonMock.mock.calls[0][0];
  expect(payload.availableDates.at(0)).toBe('2024-04-01');
  expect(payload.dates).toEqual(['2024-04-01', '2024-04-03']);
  expect(Object.keys(payload.users[0].availability)).toEqual([
    '2024-04-01',
    '2024-04-03',
  ]);
  expect(payload.users[0].availability['2024-04-03']).toMatchObject({
    status: 'PARTIAL',
    preset: true,
  });
});

test('list spans the next ISO week across year boundary in Moscow time', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-12-29T12:00:00Z'));

  listForUserMock.mockResolvedValue([]);
  getAvailabilityLocksMock.mockReturnValue({
    fullyLocked: false,
    limitedLocked: false,
  });

  const controller = (await import(controllerPath)).default;
  const jsonMock = jest.fn();

  await controller.list({ user: { id: 'u1' } }, { json: jsonMock });

  expect(listForUserMock).toHaveBeenCalledWith(
    'u1',
    '2024-12-23',
    '2025-01-05'
  );
  const payload = jsonMock.mock.calls[0][0];
  expect(payload.days.some((d) => d.date === '2025-01-01')).toBe(true);
});

test('list derives split partial mode when to_time is before from_time', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-04-01T00:00:00Z'));

  listForUserMock.mockResolvedValue([
    {
      date: '2024-04-02',
      AvailabilityType: { alias: 'PARTIAL' },
      from_time: '14:00:00',
      to_time: '10:00:00',
    },
  ]);
  getAvailabilityLocksMock.mockReturnValue({
    fullyLocked: false,
    limitedLocked: false,
  });

  const controller = (await import(controllerPath)).default;
  const jsonMock = jest.fn();

  await controller.list({ user: { id: 'u1' } }, { json: jsonMock });

  const payload = jsonMock.mock.calls[0][0];
  const day = payload.days.find((d) => d.date === '2024-04-02');
  expect(day.partial_mode).toBe('SPLIT');
});

test('adminGrid falls back to full range when requested dates miss the window', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-04-01T00:00:00Z'));

  listUsersMock.mockResolvedValue({ rows: [] });
  toPublicArrayMock.mockReturnValue([]);
  listForUsersMock.mockResolvedValue([]);

  const controller = (await import(controllerPath)).default;
  const jsonMock = jest.fn();

  await controller.adminGrid(
    {
      query: {
        date: ['2024-03-01'],
      },
    },
    { json: jsonMock }
  );

  const payload = jsonMock.mock.calls[0][0];
  expect(payload.dates).toEqual(payload.availableDates);
  expect(payload.availableDates.length).toBeGreaterThan(0);
});

test('adminDetail returns editable window for a referee', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-04-01T00:00:00Z'));

  getUserMock.mockResolvedValue({
    id: 'u1',
    Roles: [{ alias: 'REFEREE' }],
    UserStatus: { alias: 'ACTIVE' },
  });
  toPublicMock.mockReturnValue({ id: 'u1', last_name: 'Сидоров' });
  listForUserMock.mockResolvedValue([
    {
      date: '2024-04-01',
      AvailabilityType: { alias: 'BUSY' },
      from_time: null,
      to_time: null,
    },
    {
      date: '2024-04-05',
      AvailabilityType: { alias: 'PARTIAL' },
      from_time: '12:00:00',
      to_time: null,
    },
  ]);

  const controller = (await import(controllerPath)).default;
  const jsonMock = jest.fn();

  await controller.adminDetail(
    { params: { userId: 'u1' } },
    { json: jsonMock }
  );

  expect(getUserMock).toHaveBeenCalledWith('u1');
  const payload = jsonMock.mock.calls[0][0];
  expect(payload.user).toEqual({ id: 'u1', last_name: 'Сидоров' });
  expect(payload.dates[0]).toBe('2024-04-01');
  expect(payload.dates.at(-1)).toBe('2024-04-14');
  const partialDay = payload.days.find((d) => d.date === '2024-04-05');
  expect(partialDay).toMatchObject({
    preset: true,
    status: 'PARTIAL',
    from_time: '12:00:00',
    fully_locked: false,
  });
});

test('adminSet updates and clears availability without policy limits', async () => {
  getUserMock.mockResolvedValue({
    id: 'u1',
    Roles: [{ alias: 'REFEREE' }],
    UserStatus: { alias: 'ACTIVE' },
  });

  const controller = (await import(controllerPath)).default;
  const statusMock = jest.fn().mockReturnThis();
  const endMock = jest.fn();

  await controller.adminSet(
    {
      params: { userId: 'u1' },
      user: { id: 'admin-1' },
      body: {
        days: [
          { date: '2024-04-02', status: 'busy' },
          { date: '2024-04-03', status: null },
        ],
      },
    },
    { status: statusMock, end: endMock }
  );

  expect(setForUserMock).toHaveBeenCalledWith(
    'u1',
    [
      {
        date: '2024-04-02',
        status: 'BUSY',
        from_time: null,
        to_time: null,
        partial_mode: null,
      },
    ],
    'admin-1',
    { enforcePolicy: false }
  );
  expect(clearForUserMock).toHaveBeenCalledWith(
    'u1',
    ['2024-04-03'],
    'admin-1'
  );
  expect(statusMock).toHaveBeenCalledWith(204);
  expect(endMock).toHaveBeenCalled();
});
