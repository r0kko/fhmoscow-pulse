import { jest, describe, expect, beforeEach, test } from '@jest/globals';

const listForGalleryMock = jest.fn();
const listGalleryFiltersMock = jest.fn();
const mapperMock = { toPublic: jest.fn() };

jest.unstable_mockModule('../src/services/playerService.js', () => ({
  default: {
    list: jest.fn(),
    listAll: jest.fn(),
    syncExternal: jest.fn(),
    facets: jest.fn(),
    listForGallery: listForGalleryMock,
    listGalleryFilters: listGalleryFiltersMock,
  },
  seasonBirthYearCounts: jest.fn(),
  seasonTeamSummaries: jest.fn(),
}));

jest.unstable_mockModule('../src/mappers/playerMapper.js', () => ({
  default: mapperMock,
}));

const controller = (await import('../src/controllers/playerController.js'))
  .default;

beforeEach(() => {
  listForGalleryMock.mockReset();
  listGalleryFiltersMock.mockReset();
  mapperMock.toPublic.mockReset();
});

describe('playerController.gallery', () => {
  test('returns 403 when staff has no assigned scope', async () => {
    const req = {
      query: {},
      access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.gallery(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Доступ запрещён' });
    expect(listForGalleryMock).not.toHaveBeenCalled();
  });

  test('maps gallery results and returns pagination metadata', async () => {
    listForGalleryMock.mockResolvedValue({
      rows: [{ id: 'p1' }],
      count: 1,
      page: 1,
      pageSize: 40,
    });
    mapperMock.toPublic.mockReturnValue({ id: 'p1', full_name: 'Player One' });

    const req = {
      query: { page: '1', limit: '20', search: 'иван' },
      access: {
        isAdmin: false,
        allowedClubIds: ['c1'],
        allowedTeamIds: [],
      },
    };
    const res = {
      json: jest.fn(),
    };

    await controller.gallery(req, res);

    expect(listForGalleryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        search: 'иван',
        clubIds: ['c1'],
        teamIds: [],
        seasonIds: [],
        requireActiveClub: true,
        requirePhoto: false,
        requirePhotoMissing: false,
        teamBirthYears: [],
      })
    );
    expect(mapperMock.toPublic).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      0,
      [{ id: 'p1' }]
    );
    expect(res.json).toHaveBeenCalledWith({
      players: [{ id: 'p1', full_name: 'Player One' }],
      total: 1,
      page: 1,
      per_page: 40,
      total_pages: 1,
    });
  });

  test('admin can request without scope and keeps pagination defaults', async () => {
    listForGalleryMock.mockResolvedValue({
      rows: [],
      count: 0,
      page: 2,
      pageSize: 15,
    });
    mapperMock.toPublic.mockReturnValueOnce(null);

    const req = {
      query: { page: '2', limit: '15' },
      access: { isAdmin: true },
    };
    const res = {
      json: jest.fn(),
    };

    await controller.gallery(req, res);

    expect(listForGalleryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 15,
        clubIds: [],
        teamIds: [],
        seasonIds: [],
        requireActiveClub: true,
        requirePhoto: false,
        requirePhotoMissing: false,
        teamBirthYears: [],
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      players: [],
      total: 0,
      page: 2,
      per_page: 15,
      total_pages: 0,
    });
  });

  test('supports team birth year and without-photo filters', async () => {
    listForGalleryMock.mockResolvedValue({
      rows: [],
      count: 0,
      page: 1,
      pageSize: 40,
    });

    const req = {
      query: {
        team_birth_year: '2007',
        photo_filter: 'without',
      },
      access: {
        isAdmin: false,
        allowedClubIds: ['club-1'],
        allowedTeamIds: ['team-1'],
      },
    };
    const res = {
      json: jest.fn(),
    };

    await controller.gallery(req, res);

    expect(listForGalleryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamBirthYears: ['2007'],
        requirePhoto: false,
        requirePhotoMissing: true,
      })
    );
  });

  test('returns 400 for conflicting photo filters', async () => {
    const req = {
      query: {
        require_photo: 'true',
        photo_filter: 'without',
      },
      access: {
        isAdmin: false,
        allowedClubIds: ['club-1'],
        allowedTeamIds: [],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.gallery(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Некорректный фильтр фотографий' });
    expect(listForGalleryMock).not.toHaveBeenCalled();
  });
});

describe('playerController.galleryFilters', () => {
  test('returns 403 when staff has no assigned scope', async () => {
    const req = {
      query: { mine: 'true' },
      access: { isAdmin: false, allowedClubIds: [], allowedTeamIds: [] },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.galleryFilters(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Доступ запрещён' });
    expect(listGalleryFiltersMock).not.toHaveBeenCalled();
  });

  test('validates club filter against staff scope', async () => {
    const req = {
      query: { mine: 'true', club_id: 'club-2' },
      access: {
        isAdmin: false,
        allowedClubIds: ['club-1'],
        allowedTeamIds: ['team-1'],
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.galleryFilters(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Доступ запрещён' });
    expect(listGalleryFiltersMock).not.toHaveBeenCalled();
  });

  test('returns filters payload with scoped clubs', async () => {
    listGalleryFiltersMock.mockResolvedValue({
      clubs: [{ id: 'club-1', name: 'Клуб' }],
      team_birth_years: [2007],
    });

    const req = {
      query: { mine: 'true' },
      access: {
        isAdmin: false,
        allowedClubIds: ['club-1'],
        allowedTeamIds: ['team-1'],
      },
    };
    const res = {
      json: jest.fn(),
    };

    await controller.galleryFilters(req, res);

    expect(listGalleryFiltersMock).toHaveBeenCalledWith({
      clubIds: ['club-1'],
      teamIds: ['team-1'],
      filterClubId: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({
      clubs: [{ id: 'club-1', name: 'Клуб' }],
      team_birth_years: [2007],
    });
  });
});
