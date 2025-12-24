import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const listForGallery = jest.fn();
const list = jest.fn();
const listUsersForTeams = jest.fn();
const toPublic = jest.fn((x) => x);
const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};

jest.unstable_mockModule('../src/services/playerService.js', () => ({
  __esModule: true,
  default: { listForGallery },
  seasonBirthYearCounts: jest.fn(),
  seasonTeamSummaries: jest.fn(),
}));

jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: { list },
  listUsersForTeams,
}));

jest.unstable_mockModule('../src/services/clubService.js', () => ({
  __esModule: true,
  default: { list: jest.fn() },
}));

jest.unstable_mockModule('../src/mappers/playerMapper.js', () => ({
  __esModule: true,
  default: { toPublic },
}));

jest.unstable_mockModule('../src/mappers/playerPhotoRequestMapper.js', () => ({
  __esModule: true,
  default: { toPublic },
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: jest.fn(),
}));

jest.unstable_mockModule('../src/config/externalMariaDb.js', () => ({
  __esModule: true,
  isExternalDbAvailable: () => false,
  deleteExternalFileById: jest.fn(),
  insertExternalFileRecord: jest.fn(),
  updateExternalFileName: jest.fn(),
  updateExternalPlayerPhotoId: jest.fn(),
}));

const { default: controller } =
  await import('../src/controllers/playerController.js');

beforeEach(() => {
  listForGallery.mockReset();
  list.mockReset();
  listUsersForTeams.mockReset();
  toPublic.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('gallery rejects when scoped access has no clubs/teams', async () => {
  const response = res();
  await controller.gallery(
    {
      query: {},
      access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
    },
    response
  );
  expect(response.status).toHaveBeenCalledWith(403);
});

test('gallery rejects conflicting photo filters', async () => {
  const response = res();
  await controller.gallery(
    {
      query: { require_photo: 'true', without_photo: 'true' },
      access: { isAdmin: true },
    },
    response
  );
  expect(response.status).toHaveBeenCalledWith(400);
});

test('gallery passes normalized filters to service and paginates', async () => {
  const response = res();
  listForGallery.mockResolvedValue({
    rows: [{ id: 1 }],
    count: 1,
    pageSize: 20,
    page: 1,
  });
  toPublic.mockImplementation((x) => x);
  await controller.gallery(
    {
      query: {
        page: '2',
        limit: '10',
        club_id: '1',
        team_id: '2',
        search: 'p',
      },
      access: { isAdmin: true },
    },
    response
  );
  expect(listForGallery).toHaveBeenCalledWith(
    expect.objectContaining({
      page: 2,
      limit: 10,
      clubIds: ['1'],
      teamIds: ['2'],
    })
  );
  expect(response.json).toHaveBeenCalledWith({
    players: [{ id: 1 }],
    total: 1,
    total_pages: 1,
    page: 1,
    per_page: 20,
  });
});
