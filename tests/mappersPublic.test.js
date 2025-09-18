import { afterAll, describe, expect, test } from '@jest/globals';

const originalExtFilesBase = process.env.EXT_FILES_PUBLIC_BASE_URL;
const originalModuleMap = process.env.EXT_FILES_MODULE_MAP;
process.env.EXT_FILES_PUBLIC_BASE_URL = 'https://cdn.test';
process.env.EXT_FILES_MODULE_MAP = 'playerPhoto=person/player/photo';

const playerMapper = (await import('../src/mappers/playerMapper.js')).default;
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
  });
});
