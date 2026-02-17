import { beforeEach, expect, jest, test } from '@jest/globals';

const listNextGameDaysMock = jest.fn();
const listNextDaysMock = jest.fn();
const updateScheduleAndLockMock = jest.fn();

jest.unstable_mockModule('../src/services/matchAdminService.js', () => ({
  __esModule: true,
  default: {
    listNextGameDays: listNextGameDaysMock,
    listNextDays: listNextDaysMock,
  },
  updateScheduleAndLock: updateScheduleAndLockMock,
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: jest.fn(),
}));

const { default: controller } =
  await import('../src/controllers/matchAdminController.js');

beforeEach(() => {
  listNextGameDaysMock.mockReset();
  listNextDaysMock.mockReset();
  updateScheduleAndLockMock.mockReset();
});

test('calendar normalizes game-days query payload and enforces bounds', async () => {
  listNextGameDaysMock.mockResolvedValue({
    matches: [],
    range: null,
    game_days: [],
  });

  const homeClubValues = Array.from({ length: 40 }, (_, i) => ` Клуб-${i} `);
  const req = {
    query: {
      q: `   ${'x'.repeat(120)}   `,
      home_club: [...homeClubValues, 'Клуб-1', '   '],
      away_club: [' Гость-1 ', 'Гость-1', 'Гость-2'],
      tournament: [' Кубок A ', 'Кубок A', 'Кубок B'],
      group: [' Группа 1 ', 'Группа 1'],
      stadium: [' Стадион ', 'Стадион'],
      game_days: 'true',
      count: '120',
      horizon: '999',
      direction: 'unknown',
      anchor: '2024-04-15',
    },
  };
  const json = jest.fn();
  const res = { json };
  const next = jest.fn();

  await controller.calendar(req, res, next);

  expect(listNextGameDaysMock).toHaveBeenCalledTimes(1);
  const args = listNextGameDaysMock.mock.calls[0][0];
  expect(args.q).toHaveLength(80);
  expect(args.homeClubs).toHaveLength(30);
  expect(args.homeClubs[0]).toBe('Клуб-0');
  expect(args.awayClubs).toEqual(['Гость-1', 'Гость-2']);
  expect(args.tournaments).toEqual(['Кубок A', 'Кубок B']);
  expect(args.groups).toEqual(['Группа 1']);
  expect(args.stadiums).toEqual(['Стадион']);
  expect(args.count).toBe(31);
  expect(args.horizonDays).toBe(180);
  expect(args.direction).toBe('forward');
  expect(args.anchorDate).toBeInstanceOf(Date);

  expect(json).toHaveBeenCalledWith(
    expect.objectContaining({
      matches: [],
      range: null,
      days: 31,
      game_days: [],
      direction: 'forward',
    })
  );
  expect(next).not.toHaveBeenCalled();
});

test('calendar uses listNextDays branch for plain days mode', async () => {
  listNextDaysMock.mockResolvedValue({ matches: [{ id: 'm1' }], range: {} });

  const req = {
    query: {
      days: '0',
      q: ' поиск ',
      home_club: [' Клуб A ', 'Клуб A'],
      game_days: 'false',
    },
  };
  const json = jest.fn();
  const res = { json };

  await controller.calendar(req, res, jest.fn());

  expect(listNextDaysMock).toHaveBeenCalledWith(
    expect.objectContaining({
      days: 1,
      q: 'поиск',
      homeClubs: ['Клуб A'],
    })
  );
  expect(json).toHaveBeenCalledWith({
    matches: [{ id: 'm1' }],
    range: {},
    days: 1,
  });
});

test('calendar forwards service failures to next()', async () => {
  const err = new Error('boom');
  listNextGameDaysMock.mockRejectedValue(err);

  const req = {
    query: { game_days: 'true' },
  };
  const res = { json: jest.fn() };
  const next = jest.fn();

  await controller.calendar(req, res, next);

  expect(next).toHaveBeenCalledWith(err);
});
