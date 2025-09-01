import { expect, jest, test, beforeEach } from '@jest/globals';

const findByPkMatchMock = jest.fn();
const findByPkUserMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: findByPkMatchMock },
  User: { findByPk: findByPkUserMock },
  // Stubs for included models (not directly called)
  Team: {},
  Ground: {},
  Tournament: {},
  TournamentGroup: {},
  Tour: {},
  Season: {},
  Stage: {},
  Address: {},
}));

const { get: getMatch } = await import('../src/controllers/matchController.js');

beforeEach(() => {
  findByPkMatchMock.mockReset();
  findByPkUserMock.mockReset();
});

test('get returns extended meta and ground details', async () => {
  const req = { params: { id: 'm1' }, user: { id: 'u1' } };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  const next = jest.fn();

  // User is part of home team
  findByPkUserMock.mockResolvedValue({ Teams: [{ id: 'home-id' }] });

  // Match with associations resolved inline resembling Sequelize instance shape
  findByPkMatchMock.mockResolvedValue({
    id: 'm1',
    date_start: '2025-09-10T12:00:00.000Z',
    team1_id: 'home-id',
    team2_id: 'away-id',
    Ground: { id: 'g1', name: 'Арена', yandex_url: 'https://yandex.ru/maps', Address: { result: 'Москва, ул. Пушкина' } },
    HomeTeam: { name: 'Команда А' },
    AwayTeam: { name: 'Команда Б' },
    Tournament: { name: 'Кубок' },
    Stage: { name: '1/8 финала' },
    TournamentGroup: { name: 'Группа A' },
    Tour: { name: 'Тур 5' },
    Season: { name: '2025/26' },
  });

  await getMatch(req, res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalled();
  const payload = res.json.mock.calls[0][0];
  expect(payload.match).toEqual(
    expect.objectContaining({
      id: 'm1',
      team1: 'Команда А',
      team2: 'Команда Б',
      tournament: 'Кубок',
      stage: '1/8 финала',
      group: 'Группа A',
      tour: 'Тур 5',
      season: '2025/26',
      is_home: true,
      is_away: false,
      ground: 'Арена',
      ground_details: expect.objectContaining({
        name: 'Арена',
        address: 'Москва, ул. Пушкина',
        yandex_url: 'https://yandex.ru/maps',
      }),
    })
  );
});

