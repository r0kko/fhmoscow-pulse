import { afterAll, describe, expect, test } from '@jest/globals';

const originalExtFilesBase = process.env.EXT_FILES_PUBLIC_BASE_URL;
const originalModuleMap = process.env.EXT_FILES_MODULE_MAP;
process.env.EXT_FILES_PUBLIC_BASE_URL = 'https://cdn.test';
process.env.EXT_FILES_MODULE_MAP = 'playerPhoto=person/player/photo';

const playerMapper = (await import('../src/mappers/playerMapper.js')).default;
const playerPhotoRequestMapper = (
  await import('../src/mappers/playerPhotoRequestMapper.js')
).default;
const teamMapper = (await import('../src/mappers/teamMapper.js')).default;
const clubMapper = (await import('../src/mappers/clubMapper.js')).default;

describe('public mappers', () => {
  afterAll(() => {
    process.env.EXT_FILES_PUBLIC_BASE_URL = originalExtFilesBase;
    if (originalModuleMap === undefined) {
      delete process.env.EXT_FILES_MODULE_MAP;
    } else {
      process.env.EXT_FILES_MODULE_MAP = originalModuleMap;
    }
  });

  test('teamMapper.toPublic maps basic fields and nested club', () => {
    const team = {
      id: 't1',
      external_id: 11,
      name: 'Team',
      birth_year: 2010,
      club_id: 'c1',
      Club: { id: 'c1', name: 'Club' },
    };
    expect(teamMapper.toPublic(team)).toEqual({
      id: 't1',
      external_id: 11,
      name: 'Team',
      birth_year: 2010,
      club_id: 'c1',
      club: { id: 'c1', name: 'Club' },
    });
  });

  test('clubMapper.toPublic maps basic fields and nested teams', () => {
    const club = {
      id: 'c1',
      external_id: 22,
      name: 'Club',
      Teams: [{ id: 't1', external_id: 11, name: 'Team A', birth_year: 2010 }],
    };
    const out = clubMapper.toPublic(club);
    expect(out).toMatchObject({ id: 'c1', external_id: 22, name: 'Club' });
    expect(out.teams?.length).toBe(1);
  });

  test('playerMapper.toPublic maps identity and nested associations', () => {
    const player = {
      id: 'p1',
      external_id: 33,
      surname: 'Иванов',
      name: 'Иван',
      patronymic: 'Иваныч',
      date_of_birth: '2005-01-02',
      Teams: [{ id: 't1', external_id: 11, name: 'Team A', birth_year: 2010 }],
      Clubs: [{ id: 'c1', external_id: 22, name: 'Club' }],
      Photo: {
        id: 'file-1',
        external_id: 99,
        module: 'playerPhoto',
        name: 'source-name.jpg',
        mime_type: 'image/jpeg',
        size: 12345,
        object_status: 'active',
        date_create: '2023-01-01T00:00:00Z',
        date_update: '2023-01-02T00:00:00Z',
      },
      PhotoRequests: [
        {
          id: 'req-1',
          status_id: 'status-pending',
          decision_reason: null,
          createdAt: new Date('2024-01-05T10:00:00Z'),
          updatedAt: new Date('2024-01-05T10:00:00Z'),
          File: {
            id: 'upload-1',
            original_name: 'upload.jpg',
            mime_type: 'image/jpeg',
            size: 409600,
          },
          Status: {
            id: 'status-pending',
            alias: 'pending',
            name: 'На модерации',
          },
        },
      ],
    };
    const out = playerMapper.toPublic(player);
    expect(out.full_name).toBe('Иванов Иван Иваныч');
    expect(out.teams?.length).toBe(1);
    expect(out.clubs?.length).toBe(1);
    expect(out.photo?.urls).toEqual([
      'https://cdn.test/person/player/photo/99.jpeg',
      'https://cdn.test/person/player/photo/99.jpg',
      'https://cdn.test/person/player/photo/source-name.jpg',
    ]);
    expect(out.photo).toMatchObject({
      id: 'file-1',
      external_id: 99,
      url: 'https://cdn.test/person/player/photo/99.jpeg',
    });
    expect(out.photo_url).toBe('https://cdn.test/person/player/photo/99.jpeg');
    expect(out.photo_url_candidates).toEqual(out.photo.urls);
    expect(out.photo_request).toMatchObject({
      id: 'req-1',
      status_alias: 'pending',
      status_name: 'На модерации',
      file: {
        id: 'upload-1',
        original_name: 'upload.jpg',
        mime_type: 'image/jpeg',
        size: 409600,
      },
    });
  });

  test('playerPhotoRequestMapper.toPublic exposes file and reviewer info', () => {
    const request = {
      id: 'req-42',
      status_id: 'status-rejected',
      decision_reason: 'Нужна нейтральная подложка',
      createdAt: new Date('2024-02-01T08:00:00Z'),
      updatedAt: new Date('2024-02-02T09:15:00Z'),
      reviewed_at: new Date('2024-02-02T09:15:00Z'),
      File: {
        id: 'file-55',
        key: 'player-photos/p-1/file.jpg',
        original_name: 'file.jpg',
        mime_type: 'image/jpeg',
        size: 204800,
        download_url: 'https://cdn.test/player-photos/p-1/file.jpg',
      },
      Player: {
        id: 'p-1',
        surname: 'Сидоров',
        name: 'Павел',
        patronymic: 'Иванович',
        clubs: [],
        date_of_birth: '2010-05-05',
        Teams: [{ id: 't2', name: 'Команда 2012', birth_year: 2012 }],
        Clubs: [{ id: 'c7', name: 'Юниор' }],
        Photo: {
          id: 'existing-photo',
          external_id: 777,
          module: 'playerPhoto',
          name: 'existing.jpg',
          mime_type: 'image/jpeg',
        },
      },
      Status: {
        id: 'status-rejected',
        alias: 'rejected',
        name: 'Отклонено',
      },
      ReviewedBy: {
        id: 'admin-7',
        first_name: 'Анна',
        last_name: 'Петрова',
        patronymic: 'Игоревна',
      },
    };
    const out = playerPhotoRequestMapper.toPublic(request);
    expect(out).toMatchObject({
      id: 'req-42',
      status_alias: 'rejected',
      status_name: 'Отклонено',
      decision_reason: 'Нужна нейтральная подложка',
    });
    expect(out.file).toMatchObject({
      id: 'file-55',
      download_url: 'https://cdn.test/player-photos/p-1/file.jpg',
    });
    expect(out.player.full_name).toBe('Сидоров Павел Иванович');
    expect(out.player.photo?.id).toBe('existing-photo');
    expect(out.reviewed_by.full_name).toBe('Петрова Анна Игоревна');
  });
});
