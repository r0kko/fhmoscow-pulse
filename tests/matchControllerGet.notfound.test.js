import { expect, jest, test, beforeEach } from '@jest/globals';

const findByPkMatchMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: findByPkMatchMock },
  // stubs not used in this test
  User: {},
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
});

test('get returns 404 when match not found', async () => {
  findByPkMatchMock.mockResolvedValue(null);
  const req = { params: { id: 'missing' }, user: { id: 'u' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await getMatch(req, res, next);

  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ error: 'match_not_found' });
  expect(next).not.toHaveBeenCalled();
});
