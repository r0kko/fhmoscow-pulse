import { beforeEach, expect, jest, test } from '@jest/globals';

const isExternalDbAvailableMock = jest.fn();
const updateExternalMock = jest.fn();
const extGameFindByPkMock = jest.fn();
const matchFindByPkMock = jest.fn();
const groundFindByPkMock = jest.fn();

jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  isExternalDbAvailable: () => isExternalDbAvailableMock(),
  updateExternalGameDateAndStadium: (...args) => updateExternalMock(...args),
}));

jest.unstable_mockModule('../src/externalModels/index.js', () => ({
  __esModule: true,
  Game: { findByPk: extGameFindByPkMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Match: { findByPk: matchFindByPkMock },
  Ground: { findByPk: groundFindByPkMock },
}));

const { syncApprovedMatchToExternal } =
  await import('../src/services/externalMatchSyncService.js');

beforeEach(() => {
  isExternalDbAvailableMock.mockReset();
  updateExternalMock.mockReset();
  extGameFindByPkMock.mockReset();
  matchFindByPkMock.mockReset();
  groundFindByPkMock.mockReset();
});

test('throws when external DB unavailable', async () => {
  isExternalDbAvailableMock.mockReturnValue(false);
  await expect(
    syncApprovedMatchToExternal({
      matchId: 'm',
      groundId: 'g',
      dateStart: '2025-01-01T10:00:00Z',
    })
  ).rejects.toMatchObject({ code: 'EXTERNAL_DB_UNAVAILABLE' });
});

test('returns ok when already in sync', async () => {
  isExternalDbAvailableMock.mockReturnValue(true);
  matchFindByPkMock.mockResolvedValue({ external_id: 1 });
  groundFindByPkMock.mockResolvedValue({ external_id: 2 });
  const now = new Date('2025-05-01T10:00:00Z');
  // current in MSK equals target (utcToMoscow conversion compensates)
  extGameFindByPkMock.mockResolvedValue({
    id: 1,
    date_start: new Date('2025-05-01T13:00:00Z'),
    stadium_id: 2,
  });
  const res = await syncApprovedMatchToExternal({
    matchId: 'm',
    groundId: 'g',
    dateStart: now,
  });
  expect(res).toEqual({ ok: true });
  expect(updateExternalMock).not.toHaveBeenCalled();
});

test('throws invalid date', async () => {
  isExternalDbAvailableMock.mockReturnValue(true);
  matchFindByPkMock.mockResolvedValue({ external_id: 1 });
  groundFindByPkMock.mockResolvedValue({ external_id: 2 });
  extGameFindByPkMock.mockResolvedValue({
    id: 1,
    date_start: new Date('2025-05-01T13:00:00Z'),
    stadium_id: 2,
  });
  await expect(
    syncApprovedMatchToExternal({
      matchId: 'm',
      groundId: 'g',
      dateStart: 'bad',
    })
  ).rejects.toMatchObject({ code: 'INVALID_DATE' });
});
