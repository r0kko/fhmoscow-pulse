import { beforeEach, expect, jest, test } from '@jest/globals';

const listNextGameDaysMock = jest.fn();
const listNextDaysMock = jest.fn();
const updateScheduleAndLockMock = jest.fn();
const observeAdminCalendarRequestMock = jest.fn();
const incAdminCalendarEmptyMock = jest.fn();

jest.unstable_mockModule('../src/services/matchAdminService.js', () => ({
  __esModule: true,
  CALENDAR_SEARCH_MAX_LEN: 80,
  default: {
    listNextGameDays: listNextGameDaysMock,
    listNextDays: listNextDaysMock,
  },
  updateScheduleAndLock: updateScheduleAndLockMock,
}));

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  observeAdminCalendarRequest: observeAdminCalendarRequestMock,
  incAdminCalendarEmpty: incAdminCalendarEmptyMock,
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
  observeAdminCalendarRequestMock.mockReset();
  incAdminCalendarEmptyMock.mockReset();
});

test('calendar normalizes game-days query payload and enforces bounds', async () => {
  listNextGameDaysMock.mockResolvedValue({
    matches: [],
    range: null,
    game_days: [],
    day_tabs: [],
    meta: { attention_days: 7, search_max_len: 80, direction: 'forward' },
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
      day_tabs: [],
      meta: expect.objectContaining({
        attention_days: 7,
        search_max_len: 80,
        direction: 'forward',
        result_count: 0,
        requested_anchor: '2024-04-15T00:00:00.000Z',
        requested_direction: 'forward',
        requested_count: 31,
        requested_horizon: 180,
        constraint_flags: {
          has_search: true,
          has_structural_filters: true,
        },
      }),
      direction: 'forward',
    })
  );
  expect(observeAdminCalendarRequestMock).toHaveBeenCalledWith(
    expect.objectContaining({
      direction: 'forward',
      hasSearch: true,
      count: 31,
      horizon: 180,
    })
  );
  expect(incAdminCalendarEmptyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      reason: 'constrained_empty',
      direction: 'forward',
      hasSearch: true,
      hasStructuralFilters: true,
    })
  );
  expect(next).not.toHaveBeenCalled();
});

test('calendar uses listNextDays branch for plain days mode', async () => {
  listNextDaysMock.mockResolvedValue({
    matches: [{ id: 'm1' }],
    range: {},
    day_tabs: [{ day_key: 1704067200000, count: 1, attention_count: 0 }],
    meta: { attention_days: 7, search_max_len: 80, direction: 'forward' },
  });

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
    day_tabs: [{ day_key: 1704067200000, count: 1, attention_count: 0 }],
    meta: expect.objectContaining({
      attention_days: 7,
      search_max_len: 80,
      direction: 'forward',
      result_count: 1,
      requested_anchor: null,
      requested_direction: 'forward',
      requested_count: 1,
      requested_horizon: 1,
      constraint_flags: {
        has_search: true,
        has_structural_filters: true,
      },
    }),
  });
  expect(observeAdminCalendarRequestMock).toHaveBeenCalledWith(
    expect.objectContaining({
      direction: 'forward',
      hasSearch: true,
      count: 1,
      horizon: 1,
    })
  );
  expect(incAdminCalendarEmptyMock).not.toHaveBeenCalled();
});

test('calendar accepts day as anchor alias when anchor is absent', async () => {
  listNextGameDaysMock.mockResolvedValue({
    matches: [],
    range: null,
    game_days: [],
    day_tabs: [],
    meta: { attention_days: 7, search_max_len: 80, direction: 'forward' },
  });

  const req = {
    query: {
      game_days: 'true',
      day: '1772841600000',
      count: '10',
      horizon: '30',
    },
  };
  const res = { json: jest.fn() };
  const next = jest.fn();

  await controller.calendar(req, res, next);

  expect(listNextGameDaysMock).toHaveBeenCalledTimes(1);
  const args = listNextGameDaysMock.mock.calls[0][0];
  expect(args.anchorDate).toBeInstanceOf(Date);
  expect(args.anchorDate.toISOString()).toBe('2026-03-07T00:00:00.000Z');
  expect(next).not.toHaveBeenCalled();
});

test('calendar reports no_matches_in_range metric for empty default request', async () => {
  listNextGameDaysMock.mockResolvedValue({
    matches: [],
    range: null,
    game_days: [],
    day_tabs: [],
    meta: { attention_days: 7, search_max_len: 80, direction: 'forward' },
  });

  const req = {
    query: { game_days: 'true' },
  };
  const res = { json: jest.fn() };
  const next = jest.fn();

  await controller.calendar(req, res, next);

  expect(incAdminCalendarEmptyMock).toHaveBeenCalledWith(
    expect.objectContaining({
      reason: 'no_matches_in_range',
      direction: 'forward',
      hasSearch: false,
      hasStructuralFilters: false,
    })
  );
  expect(next).not.toHaveBeenCalled();
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
