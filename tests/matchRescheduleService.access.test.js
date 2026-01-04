import { beforeEach, expect, jest, test } from '@jest/globals';

const transactionMock = jest.fn();
const matchFindMock = jest.fn();
const statusFindMock = jest.fn();
const rescheduleExternalMock = jest.fn();
const resolveContextMock = jest.fn();

beforeEach(() => {
  transactionMock.mockReset();
  matchFindMock.mockReset();
  statusFindMock.mockReset();
  rescheduleExternalMock.mockReset();
  resolveContextMock.mockReset();
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: {
    transaction: (fn) => {
      transactionMock();
      return fn({ id: 'tx' });
    },
  },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: matchFindMock },
  GameStatus: { findOne: statusFindMock },
}));

jest.unstable_mockModule('../src/utils/matchAccess.js', () => ({
  __esModule: true,
  resolveMatchAccessContext: resolveContextMock,
}));

jest.unstable_mockModule(
  '../src/services/rescheduleExternalService.js',
  () => ({
    __esModule: true,
    rescheduleExternalGameDate: rescheduleExternalMock,
  })
);

const { reschedulePostponedMatch } =
  await import('../src/services/matchRescheduleService.js');

function baseMatch() {
  return {
    id: 'm1',
    team1_id: 't1',
    team2_id: 't2',
    GameStatus: { alias: 'POSTPONED' },
    update: jest.fn(),
  };
}

test('allows admin reschedule without team membership', async () => {
  const match = baseMatch();
  matchFindMock.mockResolvedValue(match);
  statusFindMock.mockResolvedValue({ id: 'status-scheduled' });
  resolveContextMock.mockResolvedValue({
    match,
    isAdmin: true,
    isHome: false,
    isAway: false,
  });

  await reschedulePostponedMatch({
    matchId: 'm1',
    date: '2030-01-02',
    actorId: 'u1',
  });

  expect(rescheduleExternalMock).toHaveBeenCalledWith(
    expect.objectContaining({ matchId: 'm1' })
  );
  expect(match.update).toHaveBeenCalled();
  expect(transactionMock).toHaveBeenCalled();
});

test('rejects when user is not a participant', async () => {
  const match = baseMatch();
  matchFindMock.mockResolvedValue(match);
  resolveContextMock.mockResolvedValue({
    match,
    isAdmin: false,
    isHome: false,
    isAway: false,
  });

  await expect(
    reschedulePostponedMatch({
      matchId: 'm1',
      date: '2030-01-02',
      actorId: 'u1',
    })
  ).rejects.toMatchObject({ code: 'forbidden_not_match_member' });
});
