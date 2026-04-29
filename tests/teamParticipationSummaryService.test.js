import { beforeEach, expect, jest, test } from '@jest/globals';
import ExcelJS from 'exceljs';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';

const teamFindByPkMock = jest.fn();
const seasonFindByPkMock = jest.fn();
const matchFindAllMock = jest.fn();
const participantFindAllMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Team: { findByPk: teamFindByPkMock },
  Season: { findByPk: seasonFindByPkMock },
  Match: { findAll: matchFindAllMock },
  MatchParticipantPlayer: { findAll: participantFindAllMock },
  Player: {},
}));

const service = (
  await import('../src/services/teamParticipationSummaryService.js')
).default;

function matchRow(id, date, home = 'team-1', away = 'team-2') {
  return {
    id,
    date_start: date,
    team1_id: home,
    team2_id: away,
    HomeTeam: { id: home, name: home === 'team-1' ? 'Команда А' : 'Команда Б' },
    AwayTeam: { id: away, name: away === 'team-2' ? 'Команда Б' : 'Команда А' },
  };
}

function participantRow({
  id,
  matchId,
  playerId,
  externalPlayerId,
  played,
  lineupNumber = null,
  name = 'Иван',
  surname = 'Иванов',
}) {
  return {
    id,
    external_id: Number(id.replace(/\D/g, '')) || 1,
    match_id: matchId,
    team_id: 'team-1',
    player_id: playerId,
    external_player_id: externalPlayerId,
    played,
    lineup_number: lineupNumber,
    Player: playerId
      ? {
          id: playerId,
          surname,
          name,
          patronymic: null,
          date_of_birth: '2009-01-10',
        }
      : null,
  };
}

beforeEach(() => {
  teamFindByPkMock
    .mockReset()
    .mockResolvedValue({ id: 'team-1', name: 'Динамо 2014' });
  seasonFindByPkMock
    .mockReset()
    .mockResolvedValue({ id: 'season-1', name: '2025/26' });
  matchFindAllMock.mockReset();
  participantFindAllMock.mockReset();
});

test('denies sport school staff access to a team outside allowedTeamIds', async () => {
  await expect(
    service.getParticipationSummary({
      teamId: 'team-1',
      seasonId: 'season-1',
      access: { isAdmin: false, allowedTeamIds: ['team-2'] },
    })
  ).rejects.toMatchObject({ code: 'access_denied', status: 403 });

  expect(teamFindByPkMock).not.toHaveBeenCalled();
});

test('returns all season matches for the team and only protocol participant players', async () => {
  matchFindAllMock.mockResolvedValue([
    matchRow('match-1', '2026-01-10T10:00:00.000Z'),
    matchRow('match-2', '2026-01-17T10:00:00.000Z'),
  ]);
  participantFindAllMock.mockResolvedValue([
    participantRow({
      id: 'row-1',
      matchId: 'match-1',
      playerId: 'player-1',
      externalPlayerId: 101,
      played: true,
    }),
  ]);

  const result = await service.getParticipationSummary({
    teamId: 'team-1',
    seasonId: 'season-1',
    access: { isAdmin: true },
  });

  expect(result).toMatchObject({
    team_name: 'Динамо 2014',
    season_name: '2025/26',
  });
  expect(result.matches).toHaveLength(2);
  expect(result.matches.map((match) => match.id)).toEqual([
    'match-1',
    'match-2',
  ]);
  expect(result.matches[0]).toMatchObject({
    home_team_name: 'Команда А',
    away_team_name: 'Команда Б',
    has_snapshot: true,
  });
  expect(result.matches[1].has_snapshot).toBe(false);
  expect(result.players).toEqual([
    expect.objectContaining({
      id: 'player-1',
      full_name: 'Иванов Иван',
      date_of_birth: '2009-01-10',
      cells: { 'match-1': 1, 'match-2': 0 },
    }),
  ]);
});

test('counts played true and null as participation and false as absence', async () => {
  matchFindAllMock.mockResolvedValue([
    matchRow('match-1', '2026-01-10T10:00:00.000Z'),
    matchRow('match-2', '2026-01-17T10:00:00.000Z'),
    matchRow('match-3', '2026-01-24T10:00:00.000Z'),
  ]);
  participantFindAllMock.mockResolvedValue([
    participantRow({
      id: 'row-1',
      matchId: 'match-1',
      playerId: 'player-1',
      externalPlayerId: 101,
      played: true,
    }),
    participantRow({
      id: 'row-2',
      matchId: 'match-2',
      playerId: 'player-1',
      externalPlayerId: 101,
      played: null,
    }),
    participantRow({
      id: 'row-3',
      matchId: 'match-3',
      playerId: 'player-1',
      externalPlayerId: 101,
      played: false,
    }),
  ]);

  const result = await service.getParticipationSummary({
    teamId: 'team-1',
    seasonId: 'season-1',
    access: { isAdmin: true },
  });

  expect(result.players[0].cells).toEqual({
    'match-1': 1,
    'match-2': 1,
    'match-3': 0,
  });
});

test('ignores double-protocol lineup number when any row marks player as played', async () => {
  matchFindAllMock.mockResolvedValue([
    matchRow('match-1', '2026-01-10T10:00:00.000Z'),
  ]);
  participantFindAllMock.mockResolvedValue([
    participantRow({
      id: 'row-1',
      matchId: 'match-1',
      playerId: 'player-1',
      externalPlayerId: 101,
      played: false,
      lineupNumber: 1,
    }),
    participantRow({
      id: 'row-2',
      matchId: 'match-1',
      playerId: 'player-1',
      externalPlayerId: 101,
      played: true,
      lineupNumber: 2,
    }),
  ]);

  const result = await service.getParticipationSummary({
    teamId: 'team-1',
    seasonId: 'season-1',
    access: { isAdmin: true },
  });

  expect(result.players[0].cells['match-1']).toBe(1);
});

test('keeps rows without local player mapping by external player id', async () => {
  matchFindAllMock.mockResolvedValue([
    matchRow('match-1', '2026-01-10T10:00:00.000Z'),
  ]);
  participantFindAllMock.mockResolvedValue([
    participantRow({
      id: 'row-1',
      matchId: 'match-1',
      playerId: null,
      externalPlayerId: 101,
      played: true,
    }),
  ]);

  const result = await service.getParticipationSummary({
    teamId: 'team-1',
    seasonId: 'season-1',
    access: { isAdmin: true },
  });

  expect(result.players).toEqual([
    expect.objectContaining({
      id: 'external:101',
      player_id: null,
      external_player_id: 101,
      full_name: 'Игрок 101',
      cells: { 'match-1': 1 },
    }),
  ]);
});

test('exports xlsx only for selected players', async () => {
  matchFindAllMock.mockResolvedValue([
    matchRow('match-1', '2026-01-10T10:00:00.000Z'),
  ]);
  participantFindAllMock.mockResolvedValue([
    participantRow({
      id: 'row-1',
      matchId: 'match-1',
      playerId: 'player-1',
      externalPlayerId: 101,
      played: true,
      surname: 'Иванов',
      name: 'Иван',
    }),
    participantRow({
      id: 'row-2',
      matchId: 'match-1',
      playerId: 'player-2',
      externalPlayerId: 102,
      played: false,
      surname: 'Петров',
      name: 'Петр',
    }),
  ]);

  const payload = await service.exportParticipationSummaryXlsx({
    teamId: 'team-1',
    seasonId: 'season-1',
    access: { isAdmin: true },
    playerIds: ['player-2'],
  });

  expect(payload.filename).toMatch(
    /^Сводка участия - Динамо 2014 - 2025 26 - \d{4}-\d{2}-\d{2}\.xlsx$/
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(payload.buffer);
  const sheet = workbook.getWorksheet('Участие');

  expect(sheet.getCell('A1').value).toBe('ФИО игрока');
  expect(sheet.getCell('C1').value).toContain('Команда А');
  expect(sheet.getCell('D1').value).toBe('% участия');
  expect(sheet.getCell('A2').value).toBe('Петров Петр');
  expect(sheet.getCell('C2').value).toBe(0);
  expect(sheet.getCell('D2').value).toBe(0);
  expect(sheet.getCell('A3').value).toBeNull();
});

test('exports signed pdf only for selected players without persistence', async () => {
  matchFindAllMock.mockResolvedValue([
    matchRow('match-1', '2026-01-10T10:00:00.000Z'),
    matchRow('match-2', '2026-01-17T10:00:00.000Z'),
  ]);
  participantFindAllMock.mockResolvedValue([
    participantRow({
      id: 'row-1',
      matchId: 'match-1',
      playerId: 'player-1',
      externalPlayerId: 101,
      played: true,
      surname: 'Иванов',
      name: 'Иван',
    }),
    participantRow({
      id: 'row-2',
      matchId: 'match-2',
      playerId: 'player-2',
      externalPlayerId: 102,
      played: null,
      surname: 'Петров',
      name: 'Петр',
    }),
  ]);

  const payload = await service.exportParticipationSummarySignedPdf({
    teamId: 'team-1',
    seasonId: 'season-1',
    access: { isAdmin: true },
    playerIds: ['player-2'],
    meta: {
      registry_number: '98239',
      event_name: 'Тестовое мероприятие',
      event_date_start: '2026-02-18',
      event_date_end: '2026-02-27',
    },
  });

  expect(payload.filename).toMatch(
    /^Выписка из протокола - Динамо 2014 - 2025 26 - \d{4}-\d{2}-\d{2}\.pdf$/
  );
  expect(payload.buffer.subarray(0, 4).toString()).toBe('%PDF');
  expect(payload.buffer.length).toBeGreaterThan(1000);
});

test('fits 34 signed pdf match columns on one landscape page by width', async () => {
  const matches = Array.from({ length: 34 }, (_, index) =>
    matchRow(
      `match-${index + 1}`,
      `2026-02-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
      index % 2 ? 'team-1' : 'team-3',
      index % 2 ? 'team-3' : 'team-1'
    )
  );
  matchFindAllMock.mockResolvedValue(
    matches.map((match, index) => ({
      ...match,
      HomeTeam: {
        id: match.team1_id,
        name:
          index % 2
            ? 'Академия Атлант 2013'
            : 'Московская Академия Созвездие 2013',
      },
      AwayTeam: {
        id: match.team2_id,
        name: index % 2 ? 'Метеор Северная Звезда' : 'Академия Атлант 2013',
      },
    }))
  );
  participantFindAllMock.mockResolvedValue(
    matches.flatMap((match, matchIndex) => [
      participantRow({
        id: `row-a-${matchIndex}`,
        matchId: match.id,
        playerId: 'player-1',
        externalPlayerId: 101,
        played: matchIndex % 3 !== 0,
        surname: 'Александров',
        name: 'Платон',
      }),
      participantRow({
        id: `row-b-${matchIndex}`,
        matchId: match.id,
        playerId: 'player-2',
        externalPlayerId: 102,
        played: true,
        surname: 'Басс',
        name: 'Платон',
      }),
    ])
  );

  const payload = await service.exportParticipationSummarySignedPdf({
    teamId: 'team-1',
    seasonId: 'season-1',
    access: { isAdmin: true },
    playerIds: ['player-1', 'player-2'],
    meta: {
      registry_number: '232123',
      event_name: 'ТЫЦ ТЫЦ',
      event_date_start: '2026-04-21',
      event_date_end: '2026-04-24',
    },
  });
  const pdf = await PdfLibDocument.load(payload.buffer);

  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getSize()).toMatchObject({
    width: expect.any(Number),
    height: expect.any(Number),
  });
  expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());
});

test('splits signed pdf only by player rows when many players are selected', async () => {
  const matches = Array.from({ length: 34 }, (_, index) =>
    matchRow(
      `match-${index + 1}`,
      `2026-02-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`
    )
  );
  const players = Array.from({ length: 25 }, (_, index) => ({
    id: `player-${index + 1}`,
    externalPlayerId: 1000 + index,
    surname: 'Тестов',
    name: `Игрок${index + 1}`,
  }));
  matchFindAllMock.mockResolvedValue(matches);
  participantFindAllMock.mockResolvedValue(
    players.flatMap((player, playerIndex) =>
      matches.map((match, matchIndex) =>
        participantRow({
          id: `row-${playerIndex}-${matchIndex}`,
          matchId: match.id,
          playerId: player.id,
          externalPlayerId: player.externalPlayerId,
          played: (playerIndex + matchIndex) % 4 !== 0,
          surname: player.surname,
          name: player.name,
        })
      )
    )
  );

  const payload = await service.exportParticipationSummarySignedPdf({
    teamId: 'team-1',
    seasonId: 'season-1',
    access: { isAdmin: true },
    playerIds: players.map((player) => player.id),
    meta: {
      registry_number: '232123',
      event_name:
        'XIII зимняя Спартакиада учащихся по хоккею среди юношей 2013 года рождения',
      event_date_start: '2026-04-21',
      event_date_end: '2026-04-24',
    },
  });
  const pdf = await PdfLibDocument.load(payload.buffer);

  expect(pdf.getPageCount()).toBeGreaterThan(1);
  expect(pdf.getPageCount()).toBeLessThanOrEqual(3);
  for (const page of pdf.getPages()) {
    expect(page.getWidth()).toBeGreaterThan(page.getHeight());
  }
});

test('validates signed pdf event date range before building document', async () => {
  await expect(
    service.exportParticipationSummarySignedPdf({
      teamId: 'team-1',
      seasonId: 'season-1',
      access: { isAdmin: true },
      playerIds: ['player-1'],
      meta: {
        registry_number: '98239',
        event_name: 'Тестовое мероприятие',
        event_date_start: '2026-02-27',
        event_date_end: '2026-02-18',
      },
    })
  ).rejects.toMatchObject({
    code: 'event_date_range_invalid',
    status: 422,
  });

  expect(matchFindAllMock).not.toHaveBeenCalled();
});
