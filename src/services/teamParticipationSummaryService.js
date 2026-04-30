import { Op } from 'sequelize';
import ExcelJS from 'exceljs';

import sequelize from '../config/database.js';
import {
  Club,
  Document,
  DocumentStatus,
  DocumentType,
  File,
  IasEvent,
  Match,
  MatchParticipantPlayer,
  Player,
  Season,
  SignType,
  Stage,
  Team,
  Tournament,
} from '../models/index.js';

import fileService from './fileService.js';
import { nextDocumentNumber } from './numberingService.js';

function serviceError(code, status = 400, details) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  if (details !== undefined) err.details = details;
  return err;
}

function assertTeamAccess(teamId, access = {}) {
  if (access.isAdmin) return;
  const allowedTeamIds = new Set((access.allowedTeamIds || []).map(String));
  if (!allowedTeamIds.has(String(teamId))) {
    throw serviceError('access_denied', 403);
  }
}

function fullName(player) {
  return [player?.surname, player?.name, player?.patronymic]
    .filter(Boolean)
    .join(' ');
}

function fallbackPlayerName(row) {
  if (row.external_player_id) return `Игрок ${row.external_player_id}`;
  return 'Игрок без маппинга';
}

function formatDateLabel(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(date);
}

function formatEventLabel(event) {
  return [
    `№ ${event.registry_number}`,
    `${formatDateLabel(event.date_start)} - ${formatDateLabel(event.date_end)}`,
    event.name,
  ]
    .filter(Boolean)
    .join(' · ');
}

function playerKey(row) {
  if (row.player_id) return String(row.player_id);
  if (row.external_player_id) return `external:${row.external_player_id}`;
  return `row:${row.id}`;
}

function isPlayed(row) {
  return row.played === true || row.played === null || row.played === undefined;
}

function normalizePlayerIds(playerIds) {
  if (!playerIds) return [];
  const raw = Array.isArray(playerIds)
    ? playerIds
    : String(playerIds).split(',');
  return raw.map((id) => String(id).trim()).filter(Boolean);
}

function normalizeFilterIds(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))];
}

function requireSingleTournament(tournamentIds) {
  const ids = normalizeFilterIds(tournamentIds);
  if (ids.length !== 1) {
    throw serviceError('participation_summary_single_tournament_required', 422);
  }
  return ids[0];
}

function moscowDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function safeFilenamePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function sanitizeFilenameText(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 90);
}

function validateSignedPdfMeta(meta = {}) {
  const registryNumber = String(meta.registry_number || '').trim();
  const eventName = String(meta.event_name || '').trim();
  const eventDateStart = String(meta.event_date_start || '').trim();
  const eventDateEnd = String(meta.event_date_end || '').trim();

  if (!registryNumber) throw serviceError('registry_number_required', 400);
  if (registryNumber.length > 64) {
    throw serviceError('registry_number_too_long', 422);
  }
  if (!eventName) throw serviceError('event_name_required', 400);
  if (eventName.length > 500) throw serviceError('event_name_too_long', 422);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDateStart)) {
    throw serviceError('event_date_start_invalid', 422);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDateEnd)) {
    throw serviceError('event_date_end_invalid', 422);
  }
  const startTime = new Date(`${eventDateStart}T00:00:00.000Z`).getTime();
  const endTime = new Date(`${eventDateEnd}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw serviceError('event_dates_invalid', 422);
  }
  if (endTime < startTime) {
    throw serviceError('event_date_range_invalid', 422);
  }

  return {
    registry_number: registryNumber,
    event_name: eventName,
    event_date_start: eventDateStart,
    event_date_end: eventDateEnd,
  };
}

function validateSignedDocumentDates(
  { eventDateStart, eventDateEnd } = {},
  event
) {
  const start = String(eventDateStart || event?.date_start || '').trim();
  const end = String(eventDateEnd || event?.date_end || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    throw serviceError('event_date_start_invalid', 422);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw serviceError('event_date_end_invalid', 422);
  }
  const startTime = new Date(`${start}T00:00:00.000Z`).getTime();
  const endTime = new Date(`${end}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw serviceError('event_dates_invalid', 422);
  }
  if (endTime < startTime) {
    throw serviceError('event_date_range_invalid', 422);
  }

  return { event_date_start: start, event_date_end: end };
}

function iasEventToPublic(event) {
  return {
    id: event.id,
    registry_number: event.registry_number,
    name: event.name,
    date_start: event.date_start,
    date_end: event.date_end,
    label: formatEventLabel(event),
  };
}

function participationPercent(player, matches) {
  if (!matches.length) return 0;
  const playedCount = matches.reduce(
    (sum, match) => sum + Number(player.cells?.[match.id] || 0),
    0
  );
  return playedCount / matches.length;
}

function mapMatch(match, snapshotMatchIds) {
  const homeTeamName = match.HomeTeam?.name || null;
  const awayTeamName = match.AwayTeam?.name || null;
  const dateLabel = formatDateLabel(match.date_start);
  const teamsLabel = [
    homeTeamName || 'Команда А',
    awayTeamName || 'Команда Б',
  ].join(' — ');
  return {
    id: match.id,
    date_start: match.date_start,
    tournament_id: match.tournament_id || null,
    tournament_name: match.Tournament?.name || null,
    stage_id: match.stage_id || null,
    stage_name: match.Stage?.name || null,
    home_team_name: homeTeamName,
    away_team_name: awayTeamName,
    label: [dateLabel, teamsLabel].filter(Boolean).join('; '),
    has_snapshot: snapshotMatchIds.has(String(match.id)),
    home_club_is_moscow: Boolean(match.HomeTeam?.Club?.is_moscow),
    away_club_is_moscow: Boolean(match.AwayTeam?.Club?.is_moscow),
  };
}

function buildAvailableFilters(matches) {
  const tournaments = new Map();
  const stages = new Map();
  for (const match of matches) {
    if (match.tournament_id) {
      tournaments.set(String(match.tournament_id), {
        id: match.tournament_id,
        name: match.Tournament?.name || 'Турнир без названия',
      });
    }
    if (match.stage_id) {
      stages.set(String(match.stage_id), {
        id: match.stage_id,
        name: match.Stage?.name || 'Этап без названия',
        tournament_id: match.tournament_id || null,
      });
    }
  }
  return {
    available_tournaments: [...tournaments.values()].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'ru')
    ),
    available_stages: [...stages.values()].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'ru')
    ),
  };
}

function filterMatchesByScope(matches, tournamentIds, stageIds) {
  const tournamentSet = new Set(normalizeFilterIds(tournamentIds));
  const stageSet = new Set(normalizeFilterIds(stageIds));
  return matches.filter((match) => {
    if (
      tournamentSet.size &&
      !tournamentSet.has(String(match.tournament_id || ''))
    ) {
      return false;
    }
    if (stageSet.size && !stageSet.has(String(match.stage_id || ''))) {
      return false;
    }
    return true;
  });
}

function filterSummaryForMoscowOnly(summary) {
  if (!summary.team_club_is_moscow) {
    throw serviceError('participation_summary_team_not_moscow', 422);
  }
  const matches = summary.matches.filter(
    (match) => match.home_club_is_moscow && match.away_club_is_moscow
  );
  if (!matches.length) {
    throw serviceError('participation_summary_moscow_matches_not_found', 422);
  }
  return {
    ...summary,
    matches,
  };
}

export function applyMoscowOnlyFilter(summary) {
  return filterSummaryForMoscowOnly(summary);
}

export async function getParticipationSummary({
  teamId,
  seasonId,
  tournamentIds,
  stageIds,
  access,
}) {
  if (!teamId) throw serviceError('team_required', 400);
  if (!seasonId) throw serviceError('season_required', 400);
  assertTeamAccess(teamId, access);

  const [team, season] = await Promise.all([
    Team.findByPk(teamId, {
      attributes: ['id', 'name'],
      include: [{ model: Club, attributes: ['is_moscow'], required: false }],
    }),
    Season.findByPk(seasonId, {
      attributes: ['id', 'name'],
      paranoid: false,
    }),
  ]);
  if (!team) throw serviceError('team_not_found', 404);

  const allMatches = await Match.findAll({
    attributes: [
      'id',
      'date_start',
      'team1_id',
      'team2_id',
      'tournament_id',
      'stage_id',
    ],
    where: {
      season_id: seasonId,
      [Op.or]: [{ team1_id: teamId }, { team2_id: teamId }],
    },
    include: [
      { model: Tournament, attributes: ['id', 'name'], required: false },
      { model: Stage, attributes: ['id', 'name'], required: false },
      {
        model: Team,
        as: 'HomeTeam',
        attributes: ['id', 'name'],
        required: false,
        include: [{ model: Club, attributes: ['is_moscow'], required: false }],
      },
      {
        model: Team,
        as: 'AwayTeam',
        attributes: ['id', 'name'],
        required: false,
        include: [{ model: Club, attributes: ['is_moscow'], required: false }],
      },
    ],
    order: [
      ['date_start', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const filters = buildAvailableFilters(allMatches);
  const matches = filterMatchesByScope(allMatches, tournamentIds, stageIds);
  const matchIds = matches.map((match) => match.id);
  if (!matchIds.length) {
    return {
      team_id: teamId,
      team_name: team.name || null,
      team_club_is_moscow: Boolean(team.Club?.is_moscow),
      season_id: seasonId,
      season_name: season?.name || null,
      filters,
      matches: [],
      players: [],
    };
  }

  const participantRows = await MatchParticipantPlayer.findAll({
    where: {
      match_id: { [Op.in]: matchIds },
      team_id: teamId,
    },
    include: [
      {
        model: Player,
        attributes: ['id', 'surname', 'name', 'patronymic', 'date_of_birth'],
        required: false,
      },
    ],
    order: [
      ['external_player_id', 'ASC'],
      ['external_id', 'ASC'],
    ],
  });

  const snapshotMatchIds = new Set(
    participantRows.map((row) => String(row.match_id))
  );
  const matchPayload = matches.map((match) =>
    mapMatch(match, snapshotMatchIds)
  );
  const playersByKey = new Map();

  for (const row of participantRows) {
    const key = playerKey(row);
    if (!playersByKey.has(key)) {
      const cells = Object.fromEntries(matchIds.map((matchId) => [matchId, 0]));
      playersByKey.set(key, {
        id: row.player_id || key,
        player_id: row.player_id || null,
        external_player_id: row.external_player_id || null,
        full_name: fullName(row.Player) || fallbackPlayerName(row),
        date_of_birth: row.Player?.date_of_birth || null,
        cells,
      });
    }

    const player = playersByKey.get(key);
    if (isPlayed(row)) {
      player.cells[row.match_id] = 1;
    } else if (player.cells[row.match_id] !== 1) {
      player.cells[row.match_id] = 0;
    }
  }

  const players = [...playersByKey.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name, 'ru')
  );

  return {
    team_id: teamId,
    team_name: team.name || null,
    team_club_is_moscow: Boolean(team.Club?.is_moscow),
    season_id: seasonId,
    season_name: season?.name || null,
    filters,
    matches: matchPayload,
    players,
  };
}

export async function listParticipationSummaryIasEvents({
  teamId,
  seasonId,
  tournamentIds,
  access,
}) {
  if (!teamId) throw serviceError('team_required', 400);
  if (!seasonId) throw serviceError('season_required', 400);
  assertTeamAccess(teamId, access);

  const [team, season] = await Promise.all([
    Team.findByPk(teamId, { attributes: ['id'] }),
    Season.findByPk(seasonId, {
      attributes: ['id'],
      paranoid: false,
    }),
  ]);
  if (!team) throw serviceError('team_not_found', 404);
  if (!season) throw serviceError('season_not_found', 404);
  const tournamentId = requireSingleTournament(tournamentIds);

  const events = await IasEvent.findAll({
    where: { is_active: true },
    include: [
      {
        model: Tournament,
        as: 'Tournaments',
        attributes: [],
        through: { attributes: [] },
        where: { id: tournamentId },
        required: true,
      },
    ],
    order: [
      ['date_start', 'DESC'],
      ['registry_number', 'ASC'],
      ['name', 'ASC'],
    ],
  });

  return { events: events.map(iasEventToPublic) };
}

export async function exportParticipationSummaryXlsx({
  teamId,
  seasonId,
  access,
  playerIds,
  tournamentIds,
  stageIds,
  moscowOnly = false,
}) {
  const selectedIds = normalizePlayerIds(playerIds);
  if (!selectedIds.length) throw serviceError('players_required', 400);

  const baseSummary = await getParticipationSummary({
    teamId,
    seasonId,
    tournamentIds,
    stageIds,
    access,
  });
  const summary = moscowOnly
    ? filterSummaryForMoscowOnly(baseSummary)
    : baseSummary;
  const selectedIdSet = new Set(selectedIds);
  const players = summary.players.filter((player) =>
    selectedIdSet.has(String(player.id))
  );
  if (!players.length) throw serviceError('players_not_found', 404);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'fhmoscow-pulse';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Участие', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'ФИО игрока', key: 'full_name', width: 32 },
    { header: 'Дата рождения', key: 'date_of_birth', width: 14 },
    ...summary.matches.map((match) => ({
      header: match.label,
      key: `match_${match.id}`,
      width: 5,
    })),
    { header: '% участия', key: 'participation_percent', width: 12 },
  ];

  const header = sheet.getRow(1);
  header.height = 125;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF113867' },
  };
  header.alignment = {
    vertical: 'bottom',
    horizontal: 'center',
    wrapText: true,
  };
  for (let col = 3; col <= summary.matches.length + 2; col += 1) {
    header.getCell(col).alignment = {
      textRotation: 90,
      vertical: 'bottom',
      horizontal: 'center',
      wrapText: true,
    };
  }
  header.getCell(summary.matches.length + 3).alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };

  for (const player of players) {
    const row = {
      full_name: player.full_name || '—',
      date_of_birth: player.date_of_birth
        ? new Date(player.date_of_birth)
        : null,
      participation_percent: participationPercent(player, summary.matches),
    };
    for (const match of summary.matches) {
      row[`match_${match.id}`] = Number(player.cells?.[match.id] || 0);
    }
    const added = sheet.addRow(row);
    added.getCell('date_of_birth').numFmt = 'dd.mm.yyyy';
    added.getCell('participation_percent').numFmt = '0%';
    added.getCell('participation_percent').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    for (let col = 3; col <= summary.matches.length + 2; col += 1) {
      const cell = added.getCell(col);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: cell.value === 1 ? 'FFD1E7DD' : 'FFF8D7DA' },
      };
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: summary.matches.length + 3 },
  };
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE6EAF0' } },
        left: { style: 'thin', color: { argb: 'FFE6EAF0' } },
        bottom: { style: 'thin', color: { argb: 'FFE6EAF0' } },
        right: { style: 'thin', color: { argb: 'FFE6EAF0' } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filenameParts = [
    'Сводка участия',
    sanitizeFilenameText(summary.team_name) ||
      safeFilenamePart(teamId) ||
      'команда',
    sanitizeFilenameText(summary.season_name),
    moscowDateKey(),
  ].filter(Boolean);
  return {
    buffer: Buffer.from(buffer),
    filename: `${filenameParts.join(' - ')}.xlsx`,
  };
}

export async function exportParticipationSummarySignedPdf({
  teamId,
  seasonId,
  access,
  playerIds,
  tournamentIds,
  stageIds,
  meta,
}) {
  const selectedIds = normalizePlayerIds(playerIds);
  if (!selectedIds.length) throw serviceError('players_required', 400);
  const signedMeta = validateSignedPdfMeta(meta);

  const summary = await getParticipationSummary({
    teamId,
    seasonId,
    tournamentIds,
    stageIds,
    access,
  });
  const selectedIdSet = new Set(selectedIds);
  const players = summary.players.filter((player) =>
    selectedIdSet.has(String(player.id))
  );
  if (!players.length) throw serviceError('players_not_found', 404);

  const { default: buildSignedPdf } =
    await import('./docBuilders/teamParticipationSummarySigned.js');
  const buffer = await buildSignedPdf({ summary, players, meta: signedMeta });
  const filenameParts = [
    'Выписка из протокола',
    sanitizeFilenameText(summary.team_name) ||
      safeFilenamePart(teamId) ||
      'команда',
    sanitizeFilenameText(summary.season_name),
    moscowDateKey(),
  ].filter(Boolean);

  return {
    buffer,
    filename: `${filenameParts.join(' - ')}.pdf`,
  };
}

export async function createParticipationSummarySignedDocument({
  teamId,
  seasonId,
  access,
  playerIds,
  iasEventId,
  tournamentIds,
  stageIds,
  eventDateStart,
  eventDateEnd,
  moscowOnly = false,
  actorId,
}) {
  if (!actorId) throw serviceError('user_required', 401);
  const selectedIds = normalizePlayerIds(playerIds);
  if (!selectedIds.length) throw serviceError('players_required', 400);
  if (!iasEventId) throw serviceError('ias_event_required', 400);
  const tournamentId = requireSingleTournament(tournamentIds);

  const baseSummary = await getParticipationSummary({
    teamId,
    seasonId,
    tournamentIds,
    stageIds,
    access,
  });
  const summary = moscowOnly
    ? filterSummaryForMoscowOnly(baseSummary)
    : baseSummary;
  const selectedIdSet = new Set(selectedIds);
  const players = summary.players.filter((player) =>
    selectedIdSet.has(String(player.id))
  );
  if (!players.length) throw serviceError('players_not_found', 404);

  const [event, docType, signedStatus, handwrittenSignType] = await Promise.all(
    [
      IasEvent.findOne({
        where: { id: iasEventId, is_active: true },
        include: [
          {
            model: Tournament,
            as: 'Tournaments',
            attributes: [],
            through: { attributes: [] },
            where: { id: tournamentId },
            required: true,
          },
        ],
      }),
      DocumentType.findOne({
        where: { alias: 'TEAM_PARTICIPATION_SUMMARY_EXTRACT' },
        attributes: ['id', 'name', 'alias', 'generated'],
      }),
      DocumentStatus.findOne({
        where: { alias: 'SIGNED' },
        attributes: ['id', 'name', 'alias'],
      }),
      SignType.findOne({
        where: { alias: 'HANDWRITTEN' },
        attributes: ['id', 'name', 'alias'],
      }),
    ]
  );
  if (!event) throw serviceError('ias_event_not_found', 404);
  if (!docType) throw serviceError('document_type_not_found', 500);
  if (!signedStatus) throw serviceError('document_status_not_found', 500);
  if (!handwrittenSignType) throw serviceError('sign_type_not_found', 500);
  const eventDates = validateSignedDocumentDates(
    { eventDateStart, eventDateEnd },
    event
  );
  const documentEvent = {
    id: event.id,
    registry_number: event.registry_number,
    name: event.name,
    date_start: eventDates.event_date_start,
    date_end: eventDates.event_date_end,
  };

  const { default: buildSignedPdf } =
    await import('./docBuilders/teamParticipationSummarySigned.js');

  let uploadedFile = null;
  let result;
  try {
    result = await sequelize.transaction(async (transaction) => {
      const documentDate = new Date();
      const documentNumber = await nextDocumentNumber(
        documentDate,
        transaction
      );
      const buffer = await buildSignedPdf({
        summary,
        players,
        event: documentEvent,
        documentNumber,
      });
      const filenameParts = [
        `Выписка из протокола №${sanitizeFilenameText(documentNumber)}`,
        sanitizeFilenameText(summary.team_name) ||
          safeFilenamePart(teamId) ||
          'команда',
        sanitizeFilenameText(summary.season_name),
      ].filter(Boolean);
      const filename = `${filenameParts.join(' - ')}.pdf`;

      uploadedFile = await fileService.saveGeneratedPdf(
        buffer,
        filename,
        actorId
      );

      try {
        const document = await Document.create(
          {
            recipient_id: actorId,
            document_type_id: docType.id,
            status_id: signedStatus.id,
            file_id: uploadedFile.id,
            sign_type_id: handwrittenSignType.id,
            name: docType.name,
            description: JSON.stringify({
              kind: 'team_participation_summary_extract',
              team_id: teamId,
              team_name: summary.team_name || null,
              season_id: seasonId,
              season_name: summary.season_name || null,
              tournament_id: tournamentId,
              stage_ids: normalizeFilterIds(stageIds),
              ias_event_id: event.id,
              ias_registry_number: event.registry_number,
              event_date_start: eventDates.event_date_start,
              event_date_end: eventDates.event_date_end,
              moscow_only: Boolean(moscowOnly),
              selected_player_ids: selectedIds,
              player_count: players.length,
              match_count: summary.matches.length,
            }),
            document_date: documentDate,
            number: documentNumber,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction }
        );
        return { document, filename };
      } catch (err) {
        if (uploadedFile?.id) {
          await fileService.removeFile(uploadedFile.id).catch(() => {});
          uploadedFile = null;
        }
        throw err;
      }
    });
  } catch (err) {
    if (uploadedFile?.id) {
      await fileService.removeFile(uploadedFile.id).catch(() => {});
    }
    throw err;
  }

  const document = await Document.findByPk(result.document.id, {
    include: [
      { model: DocumentType, attributes: ['name', 'alias', 'generated'] },
      { model: SignType, attributes: ['name', 'alias'] },
      { model: DocumentStatus, attributes: ['name', 'alias'] },
      { model: File, attributes: ['id', 'key'] },
    ],
  });
  if (!document) throw serviceError('document_not_found', 500);

  const file = document.File
    ? {
        id: document.File.id,
        url: await fileService.getDownloadUrl(document.File, {
          filename: result.filename,
        }),
      }
    : null;

  return {
    document: {
      id: document.id,
      number: document.number,
      name: document.name,
      documentDate: document.document_date,
      documentType: document.DocumentType
        ? {
            name: document.DocumentType.name,
            alias: document.DocumentType.alias,
            generated: document.DocumentType.generated,
          }
        : null,
      signType: document.SignType
        ? { name: document.SignType.name, alias: document.SignType.alias }
        : null,
      status: document.DocumentStatus
        ? {
            name: document.DocumentStatus.name,
            alias: document.DocumentStatus.alias,
          }
        : null,
    },
    file,
  };
}

export default {
  getParticipationSummary,
  applyMoscowOnlyFilter,
  listParticipationSummaryIasEvents,
  exportParticipationSummaryXlsx,
  exportParticipationSummarySignedPdf,
  createParticipationSummarySignedDocument,
};
