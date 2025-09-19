import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const listUsersMock = jest.fn();
const toPublicArrayMock = jest.fn();
const listForUsersMock = jest.fn();

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { listUsers: listUsersMock },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: { toPublicArray: toPublicArrayMock },
}));

jest.unstable_mockModule('../src/services/userAvailabilityService.js', () => ({
  __esModule: true,
  default: { listForUser: jest.fn(), setForUser: jest.fn() },
  listForUsers: listForUsersMock,
  getAvailabilityLocks: jest.fn(),
}));

const controllerPath = '../src/controllers/userAvailabilityController.js';

beforeEach(() => {
  jest.resetModules();
  listUsersMock.mockReset();
  toPublicArrayMock.mockReset();
  listForUsersMock.mockReset();
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

  expect(listForUsersMock).toHaveBeenCalledWith(['u1'], '2024-04-01', '2024-04-03');

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
