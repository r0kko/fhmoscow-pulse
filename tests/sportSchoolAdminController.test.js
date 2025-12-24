import { expect, jest, test } from '@jest/globals';

const getUser = jest.fn();
const listUserClubs = jest.fn();
const listUserTeams = jest.fn();
const listTeams = jest.fn();
const listUsersForTeams = jest.fn();
const clubToPublic = jest.fn();
const teamToPublic = jest.fn();
const userToPublic = jest.fn();
const sendError = jest.fn();

const makeRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  r.set = jest.fn();
  return r;
};

beforeEach(() => {
  getUser.mockReset();
  listUserClubs.mockReset();
  listUserTeams.mockReset();
  listTeams.mockReset();
  listUsersForTeams.mockReset();
  clubToPublic.mockReset();
  teamToPublic.mockReset();
  userToPublic.mockReset();
  sendError.mockReset();
});

jest.unstable_mockModule('../src/services/clubUserService.js', () => ({
  __esModule: true,
  default: { listUserClubs },
}));

jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: { list: listTeams, listUserTeams },
  listUsersForTeams,
}));

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: { getUser },
}));

jest.unstable_mockModule('../src/mappers/clubMapper.js', () => ({
  __esModule: true,
  default: { toPublic: clubToPublic },
}));

jest.unstable_mockModule('../src/mappers/teamMapper.js', () => ({
  __esModule: true,
  default: { toPublic: teamToPublic },
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: {
    toPublicArray: (users) => users.map(userToPublic),
  },
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError,
}));

const { default: controller } =
  await import('../src/controllers/sportSchoolAdminController.js');

test('getLinks returns mapped clubs/teams and flags', async () => {
  getUser.mockResolvedValueOnce({
    id: 'u1',
    last_name: 'Ivanov',
    first_name: 'Ivan',
    patronymic: 'I',
  });
  listUserClubs.mockResolvedValueOnce([{ id: 'c1' }]);
  listUserTeams.mockResolvedValueOnce([{ id: 't1' }]);
  clubToPublic.mockReturnValue({ id: 'c1', name: 'Club' });
  teamToPublic.mockReturnValue({ id: 't1', name: 'Team' });
  const res = makeRes();
  await controller.getLinks({ params: { id: 'u1' } }, res);
  expect(sendError).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      has_club: true,
      has_team: true,
      clubs: [{ id: 'c1', name: 'Club' }],
      teams: [{ id: 't1', name: 'Team' }],
    })
  );
});

test('listAssignments applies post-filters and paginates', async () => {
  listTeams.mockResolvedValueOnce({
    rows: [
      {
        id: 'team1',
        name: 'Spartak',
        birth_year: 2005,
        Club: { name: 'Club One' },
        get: function (opts) {
          return opts?.plain ? this : this;
        },
      },
    ],
  });
  listUsersForTeams.mockResolvedValueOnce(
    new Map([
      ['team1', [{ id: 'u1', last_name: 'Petrov', first_name: 'Petr' }]],
    ])
  );
  teamToPublic.mockReturnValue({
    id: 'team1',
    name: 'Spartak',
    birth_year: 2005,
  });
  clubToPublic.mockReturnValue({ id: 'club1', name: 'Club One' });
  userToPublic.mockReturnValue({
    id: 'u1',
    last_name: 'Petrov',
    first_name: 'Petr',
  });
  const res = makeRes();
  await controller.listAssignments(
    {
      query: {
        page: '1',
        limit: '10',
        search: 'spartak',
        birth_year: '2005',
        has_staff: 'true',
        staff: 'petrov',
      },
    },
    res
  );
  expect(res.json).toHaveBeenCalledWith({
    items: [
      expect.objectContaining({
        team: expect.objectContaining({ name: 'Spartak' }),
        users: [expect.objectContaining({ last_name: 'Petrov' })],
      }),
    ],
    total: 1,
  });
});

test('errors are routed through sendError', async () => {
  getUser.mockRejectedValueOnce(new Error('fail'));
  const res = makeRes();
  await controller.getLinks({ params: { id: 'bad' } }, res);
  expect(sendError).toHaveBeenCalled();
});
