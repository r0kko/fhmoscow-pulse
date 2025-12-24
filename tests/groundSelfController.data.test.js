import { beforeEach, expect, jest, test } from '@jest/globals';

// Mocks for Sequelize-like findAll
const groundFindAll = jest.fn();
const clubFindAll = jest.fn();
const teamFindAll = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Ground: { findAll: groundFindAll },
  Club: { findAll: clubFindAll },
  Team: { findAll: teamFindAll },
  Address: {},
}));

// Use real mapper to validate output shape
const { default: controller } =
  await import('../src/controllers/groundSelfController.js');

beforeEach(() => {
  groundFindAll.mockReset();
  clubFindAll.mockReset();
  teamFindAll.mockReset();
});

test('available groups grounds by club and merges club/team links', async () => {
  // Team #t1 belongs to club #c1
  teamFindAll.mockResolvedValueOnce([{ id: 't1', club_id: 'c1' }]);
  // Load club metadata for c1
  clubFindAll.mockResolvedValueOnce([{ id: 'c1', name: 'Клуб 1' }]);

  // Ground.findAll first call (byClub): return g1
  // second call (byTeams): return g2
  // third call (detailed with Address include): return details for g1+g2
  const orderedReturns = [
    [{ id: 'g1', name: 'Арена 1' }],
    [{ id: 'g2', name: 'Арена 2' }],
    [
      {
        id: 'g1',
        name: 'Арена 1',
        Address: {
          id: 'a1',
          result: 'Москва, ул. Пример, 1',
          geo_lat: 55.7522,
          geo_lon: 37.6156,
          metro: [
            { line: 'Арбатско-Покровская', name: 'Щёлковская', distance: 1.1 },
          ],
        },
      },
      {
        id: 'g2',
        name: 'Арена 2',
        Address: {
          id: 'a2',
          result: 'Москва, пр-т Пример, 2',
          geo_lat: 55.76,
          geo_lon: 37.62,
          metro: [],
        },
      },
    ],
  ];
  groundFindAll.mockImplementation(() =>
    Promise.resolve(orderedReturns.shift() || [])
  );

  const req = {
    access: { isAdmin: false, allowedClubIds: ['c1'], allowedTeamIds: ['t1'] },
  };
  const res = { json: jest.fn() };
  await controller.available(req, res);
  // Should merge two grounds for club c1 and map address
  expect(res.json).toHaveBeenCalled();
  const payload = res.json.mock.calls[0][0];
  expect(Array.isArray(payload.groups)).toBe(true);
  expect(payload.groups).toHaveLength(1);
  expect(payload.groups[0].club).toEqual({ id: 'c1', name: 'Клуб 1' });
  const grounds = payload.groups[0].grounds;
  expect(grounds.map((g) => g.name).sort()).toEqual(['Арена 1', 'Арена 2']);
  // Address mapped to address.result
  const g1 = grounds.find((g) => g.name === 'Арена 1');
  expect(g1.address.result).toContain('Москва');
  expect(g1.address.geo_lat).toBeCloseTo(55.7522, 4);
});

test('available returns grounds for club when no team links present', async () => {
  // No team links
  teamFindAll.mockResolvedValueOnce([]);
  // Clubs metadata
  clubFindAll.mockResolvedValueOnce([{ id: 'cX', name: 'Клуб X' }]);
  // Ground.findAll: byClub only + details
  const orderedReturns = [
    [{ id: 'g10', name: 'Стадион X' }],
    [
      {
        id: 'g10',
        name: 'Стадион X',
        Address: { id: 'ax', result: 'Москва, улица X, 10' },
      },
    ],
  ];
  groundFindAll.mockImplementation(() =>
    Promise.resolve(orderedReturns.shift() || [])
  );

  const req = {
    access: { isAdmin: false, allowedClubIds: ['cX'], allowedTeamIds: [] },
  };
  const res = { json: jest.fn() };
  await controller.available(req, res);
  const payload = res.json.mock.calls[0][0];
  expect(payload.groups).toHaveLength(1);
  expect(payload.groups[0].grounds).toHaveLength(1);
});

test('available handles internal errors via sendError', async () => {
  // Force Team.findAll to throw
  teamFindAll.mockRejectedValueOnce(new Error('boom'));
  const req = {
    access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: ['t1'] },
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.available(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ error: 'boom' });
});
