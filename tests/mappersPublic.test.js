import { describe, expect, test } from '@jest/globals';

const playerMapper = (await import('../src/mappers/playerMapper.js')).default;
const teamMapper = (await import('../src/mappers/teamMapper.js')).default;
const clubMapper = (await import('../src/mappers/clubMapper.js')).default;

describe('public mappers', () => {
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
      Teams: [
        { id: 't1', external_id: 11, name: 'Team A', birth_year: 2010 },
      ],
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
      Teams: [
        { id: 't1', external_id: 11, name: 'Team A', birth_year: 2010 },
      ],
      Clubs: [{ id: 'c1', external_id: 22, name: 'Club' }],
    };
    const out = playerMapper.toPublic(player);
    expect(out.full_name).toBe('Иванов Иван Иваныч');
    expect(out.teams?.length).toBe(1);
    expect(out.clubs?.length).toBe(1);
  });
});

