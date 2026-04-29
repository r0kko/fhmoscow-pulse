import { createHash, randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir, rm } from 'fs/promises';
import os from 'os';
import path from 'path';

import archiver from 'archiver';
import { Op } from 'sequelize';

import logger from '../../logger.js';
import {
  incMatchProtocolExportJob,
  incMatchProtocolExportRetry,
  incMatchProtocolUpstreamRequest,
  observeMatchProtocolExportDuration,
} from '../config/metrics.js';
import ServiceError from '../errors/ServiceError.js';
import {
  File,
  GameStatus,
  Match,
  MatchParticipantPlayer,
  MatchProtocolExportItem,
  MatchProtocolExportJob,
  Player,
  Season,
  Team,
} from '../models/index.js';
import { withRedisLock, buildJobLockKey } from '../utils/redisLock.js';

import fileService from './fileService.js';
import matchProtocolService from './matchProtocolService.js';
import teamParticipationSummaryService from './teamParticipationSummaryService.js';

const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SELECTED_PLAYERS = 100;
const MAX_MATCHES_PER_JOB = 60;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;
const RETRY_CAP_MS = 30_000;
const runningJobs = new Set();

function serviceError(code, status = 400, details) {
  const err = new ServiceError(code, status);
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

function normalizePlayerIds(playerIds) {
  const raw = Array.isArray(playerIds)
    ? playerIds
    : String(playerIds || '').split(',');
  return [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))];
}

function isFinishedStatus(statusAlias) {
  return String(statusAlias || '').toUpperCase() === 'FINISHED';
}

function moscowDateParts(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}-${parts.minute}`,
  };
}

function safeFilenamePart(value, fallback = 'match') {
  const text = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*—\s*/g, '--')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (text || fallback).slice(0, 120);
}

function buildPdfFilename(match) {
  const { date, time } = moscowDateParts(match.date_start);
  const teams = safeFilenamePart(
    `${match.HomeTeam?.name || 'Команда-А'}--${match.AwayTeam?.name || 'Команда-Б'}`,
    'match'
  );
  return `${date}_${time}_${teams}_match-${match.external_id || match.id}.pdf`;
}

function buildArchiveFilename(job, team, season) {
  const { date } = moscowDateParts(new Date());
  const teamPart = safeFilenamePart(team?.name, 'team');
  const seasonPart = safeFilenamePart(season?.name, 'season');
  return `protocols-${teamPart}-${seasonPart}-${date}-${job.id.slice(0, 8)}.zip`;
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values) {
  return values.map(csvEscape).join(';');
}

function fingerprint({ teamId, seasonId, playerIds, moscowOnly = false }) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        teamId: String(teamId),
        seasonId: String(seasonId),
        playerIds: [...playerIds].sort(),
        moscowOnly: Boolean(moscowOnly),
      })
    )
    .digest('hex');
}

function serializeJob(job) {
  return {
    job_id: job.id,
    status: job.status,
    total_matches: job.total_matches,
    processed_matches: job.processed_matches,
    success_count: job.success_count,
    skipped_count: job.skipped_count,
    failure_count: job.failure_count,
    error_code: job.error_code || null,
    started_at: job.started_at || null,
    finished_at: job.finished_at || null,
    expires_at: job.expires_at || null,
    download_available:
      job.status === 'COMPLETED' &&
      Boolean(job.archive_file_id) &&
      new Date(job.expires_at).getTime() > Date.now(),
  };
}

function isRetryable(err) {
  const code = String(err?.code || '');
  return [
    'match_protocol_rate_limited',
    'match_protocol_upstream_unavailable',
    's3_download_failed',
  ].includes(code);
}

function isFatalUpstreamConfig(err) {
  return String(err?.code || '') === 'match_protocol_upstream_access_denied';
}

function retryDelayMs(err, attempt) {
  const retryAfter = Number(err?.retryAfter || 0);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, RETRY_CAP_MS);
  }
  return Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_CAP_MS);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function playerLabel(row) {
  const player = row.Player;
  const fullName = [player?.surname, player?.name, player?.patronymic]
    .filter(Boolean)
    .join(' ');
  return fullName || `Игрок ${row.external_player_id}`;
}

async function selectJobMatches({
  teamId,
  seasonId,
  selectedExternalIds,
  allowedMatchIds = null,
}) {
  const matchWhere = {
    season_id: seasonId,
    [Op.or]: [{ team1_id: teamId }, { team2_id: teamId }],
  };
  if (Array.isArray(allowedMatchIds)) {
    matchWhere.id = { [Op.in]: allowedMatchIds };
  }

  const participantRows = await MatchParticipantPlayer.findAll({
    where: {
      team_id: teamId,
      external_player_id: { [Op.in]: selectedExternalIds },
      [Op.or]: [{ played: true }, { played: null }],
    },
    include: [
      {
        model: Match,
        attributes: [
          'id',
          'external_id',
          'date_start',
          'season_id',
          'team1_id',
          'team2_id',
          'game_status_id',
        ],
        where: matchWhere,
        required: true,
        include: [
          { model: GameStatus, attributes: ['alias', 'name'], required: false },
          {
            model: Team,
            as: 'HomeTeam',
            attributes: ['name'],
            required: false,
          },
          {
            model: Team,
            as: 'AwayTeam',
            attributes: ['name'],
            required: false,
          },
        ],
      },
      {
        model: Player,
        attributes: ['surname', 'name', 'patronymic'],
        required: false,
      },
    ],
    order: [
      [Match, 'date_start', 'ASC'],
      ['external_player_id', 'ASC'],
    ],
  });

  const byMatch = new Map();
  for (const row of participantRows) {
    const match = row.Match;
    if (!match) continue;
    if (!byMatch.has(match.id)) {
      byMatch.set(match.id, {
        match,
        highlightedExternalIds: new Set(),
        playerNames: new Map(),
      });
    }
    const bucket = byMatch.get(match.id);
    bucket.highlightedExternalIds.add(Number(row.external_player_id));
    bucket.playerNames.set(Number(row.external_player_id), playerLabel(row));
  }

  return [...byMatch.values()].sort((left, right) => {
    const a = new Date(left.match.date_start || 0).getTime();
    const b = new Date(right.match.date_start || 0).getTime();
    if (a !== b) return a - b;
    return String(left.match.id).localeCompare(String(right.match.id));
  });
}

async function createArchiveWriter() {
  const dir = path.join(os.tmpdir(), `match-protocol-export-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  const zipPath = path.join(dir, 'protocols.zip');
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 6 } });
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);
  return { dir, zipPath, archive, done };
}

async function renderWithRetry(item, requestId) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await item.update({ attempts: attempt });
      const result = await matchProtocolService.renderHighlightedMatchProtocol(
        item.match_id,
        {
          actorId: item.created_by || null,
          requestId,
          highlightPlayerIds: item.highlighted_external_player_ids,
        }
      );
      incMatchProtocolUpstreamRequest('success');
      return result;
    } catch (err) {
      lastError = err;
      incMatchProtocolUpstreamRequest(err?.code || 'error');
      if (
        isFatalUpstreamConfig(err) ||
        !isRetryable(err) ||
        attempt >= MAX_ATTEMPTS
      ) {
        throw err;
      }
      incMatchProtocolExportRetry(err?.code || 'retryable');
      await sleep(retryDelayMs(err, attempt));
    }
  }
  throw lastError;
}

async function refreshJobCounters(jobId) {
  const items = await MatchProtocolExportItem.findAll({
    where: { job_id: jobId },
    attributes: ['status'],
  });
  const counts = items.reduce(
    (acc, item) => {
      if (item.status !== 'QUEUED' && item.status !== 'RUNNING') {
        acc.processed_matches += 1;
      }
      if (item.status === 'SUCCESS') acc.success_count += 1;
      if (item.status === 'SKIPPED') acc.skipped_count += 1;
      if (item.status === 'FAILED') acc.failure_count += 1;
      return acc;
    },
    {
      processed_matches: 0,
      success_count: 0,
      skipped_count: 0,
      failure_count: 0,
    }
  );
  await MatchProtocolExportJob.update(counts, { where: { id: jobId } });
  return counts;
}

async function finalizeItem(item, fields) {
  await item.update({
    ...fields,
    finished_at: new Date(),
  });
  await refreshJobCounters(item.job_id);
}

async function processItem({
  item,
  archive,
  manifestRows,
  errorRows,
  requestId,
}) {
  const match = await Match.findByPk(item.match_id, {
    attributes: ['id', 'external_id', 'date_start'],
    include: [
      { model: GameStatus, attributes: ['alias', 'name'], required: false },
      { model: Team, as: 'HomeTeam', attributes: ['name'], required: false },
      { model: Team, as: 'AwayTeam', attributes: ['name'], required: false },
    ],
  });
  const filename = item.filename || buildPdfFilename(match || item);
  await item.update({ status: 'RUNNING', started_at: new Date(), filename });

  if (!match?.external_id) {
    const errorCode = 'match_protocol_external_id_missing';
    manifestRows.push([filename, item.match_id, '', 'SKIPPED', errorCode]);
    errorRows.push([filename, item.match_id, '', errorCode, '']);
    await finalizeItem(item, { status: 'SKIPPED', error_code: errorCode });
    return;
  }

  if (!isFinishedStatus(match?.GameStatus?.alias)) {
    const errorCode = 'match_protocol_requires_finished';
    manifestRows.push([
      filename,
      item.match_id,
      match.external_id,
      'SKIPPED',
      errorCode,
    ]);
    errorRows.push([
      filename,
      item.match_id,
      match.external_id,
      errorCode,
      match?.GameStatus?.alias || '',
    ]);
    await finalizeItem(item, { status: 'SKIPPED', error_code: errorCode });
    return;
  }

  try {
    const result = await renderWithRetry(item, requestId);
    archive.append(result.buffer, { name: filename });
    manifestRows.push([
      filename,
      item.match_id,
      match.external_id,
      'SUCCESS',
      item.highlighted_external_player_ids.join(','),
    ]);
    await finalizeItem(item, { status: 'SUCCESS', error_code: null });
  } catch (err) {
    const code = err?.code || 'match_protocol_export_failed';
    manifestRows.push([
      filename,
      item.match_id,
      match.external_id,
      'FAILED',
      code,
    ]);
    errorRows.push([
      filename,
      item.match_id,
      match.external_id,
      code,
      err?.upstreamStatus || err?.status || '',
    ]);
    await finalizeItem(item, {
      status: 'FAILED',
      error_code: code,
      error_message: err?.message || null,
    });
    if (isFatalUpstreamConfig(err)) throw err;
  }
}

export async function processExportJob(jobId, { requestId = null } = {}) {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);
  const start = Date.now();
  let finalStatus = 'FAILED';
  try {
    await withRedisLock(
      buildJobLockKey(`matchProtocolExport:${jobId}`),
      30 * 60_000,
      async () => {
        const job = await MatchProtocolExportJob.findByPk(jobId);
        if (!job || !['QUEUED', 'RUNNING'].includes(job.status)) return;
        await job.update({
          status: 'RUNNING',
          started_at: job.started_at || new Date(),
        });

        const items = await MatchProtocolExportItem.findAll({
          where: { job_id: job.id },
          order: [['created_at', 'ASC']],
        });
        const writer = await createArchiveWriter();
        const manifestRows = [
          ['filename', 'match_id', 'external_match_id', 'status', 'details'],
        ];
        const errorRows = [
          [
            'filename',
            'match_id',
            'external_match_id',
            'error_code',
            'details',
          ],
        ];

        try {
          for (const item of items) {
            await processItem({
              item,
              archive: writer.archive,
              manifestRows,
              errorRows,
              requestId,
            });
          }

          writer.archive.append(manifestRows.map(csvLine).join('\n') + '\n', {
            name: 'manifest.csv',
          });
          if (errorRows.length > 1) {
            writer.archive.append(errorRows.map(csvLine).join('\n') + '\n', {
              name: 'errors.csv',
            });
          }
          await writer.archive.finalize();
          await writer.done;

          const [freshJob, team, season] = await Promise.all([
            MatchProtocolExportJob.findByPk(job.id),
            Team.findByPk(job.team_id, { attributes: ['name'] }),
            Season.findByPk(job.season_id, {
              attributes: ['name'],
              paranoid: false,
            }),
          ]);
          const archiveName = buildArchiveFilename(
            freshJob || job,
            team,
            season
          );
          const file = await fileService.saveGeneratedArchiveFromPath(
            writer.zipPath,
            archiveName,
            job.requested_by_user_id || job.created_by || null
          );
          await refreshJobCounters(job.id);
          await MatchProtocolExportJob.update(
            {
              status: 'COMPLETED',
              archive_file_id: file.id,
              finished_at: new Date(),
              error_code: null,
              error_message: null,
            },
            { where: { id: job.id } }
          );
          finalStatus = 'COMPLETED';
        } catch (err) {
          finalStatus = 'FAILED';
          await MatchProtocolExportJob.update(
            {
              status: 'FAILED',
              finished_at: new Date(),
              error_code: err?.code || 'match_protocol_export_failed',
              error_message: err?.message || null,
            },
            { where: { id: job.id } }
          );
          throw err;
        } finally {
          await rm(writer.dir, { recursive: true, force: true }).catch(
            () => {}
          );
        }
      }
    );
  } catch (err) {
    logger.error('Match protocol batch export failed', {
      job_id: jobId,
      error: err?.code || err?.message || 'unknown',
    });
  } finally {
    runningJobs.delete(jobId);
    incMatchProtocolExportJob(finalStatus);
    observeMatchProtocolExportDuration(
      finalStatus,
      (Date.now() - start) / 1000
    );
  }
}

function scheduleJob(jobId, requestId = null) {
  setImmediate(() => {
    processExportJob(jobId, { requestId }).catch((err) => {
      logger.error('Match protocol batch export worker crashed', {
        job_id: jobId,
        error: err?.code || err?.message || 'unknown',
      });
    });
  });
}

export async function createExportJob({
  teamId,
  seasonId,
  playerIds,
  moscowOnly = false,
  access,
  actorId = null,
  requestId = null,
}) {
  if (!teamId) throw serviceError('team_required', 400);
  if (!seasonId) throw serviceError('season_required', 400);
  assertTeamAccess(teamId, access);

  const selectedPlayerIds = normalizePlayerIds(playerIds);
  if (!selectedPlayerIds.length) throw serviceError('players_required', 400);
  if (selectedPlayerIds.length > MAX_SELECTED_PLAYERS) {
    throw serviceError('too_many_players', 422, {
      max: MAX_SELECTED_PLAYERS,
    });
  }

  const baseSummary =
    await teamParticipationSummaryService.getParticipationSummary({
      teamId,
      seasonId,
      access,
    });
  const summary = moscowOnly
    ? teamParticipationSummaryService.applyMoscowOnlyFilter(baseSummary)
    : baseSummary;
  const selectedSet = new Set(selectedPlayerIds);
  const selectedPlayers = summary.players.filter((player) =>
    selectedSet.has(String(player.id))
  );
  const externalIds = [
    ...new Set(
      selectedPlayers
        .map((player) => Number.parseInt(String(player.external_player_id), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
  if (!externalIds.length) throw serviceError('players_not_found', 404);

  const fp = fingerprint({
    teamId,
    seasonId,
    playerIds: selectedPlayerIds,
    moscowOnly,
  });
  const existing = await MatchProtocolExportJob.findOne({
    where: {
      fingerprint: fp,
      requested_by_user_id: actorId,
      expires_at: { [Op.gt]: new Date() },
      status: { [Op.in]: ['QUEUED', 'RUNNING', 'COMPLETED'] },
    },
    order: [['created_at', 'DESC']],
  });
  if (existing) {
    if (['QUEUED', 'RUNNING'].includes(existing.status)) {
      scheduleJob(existing.id, requestId);
    }
    return {
      ...serializeJob(existing),
      already_running: ['QUEUED', 'RUNNING'].includes(existing.status),
    };
  }

  const matchBuckets = await selectJobMatches({
    teamId,
    seasonId,
    selectedExternalIds: externalIds,
    allowedMatchIds: moscowOnly
      ? summary.matches.map((match) => match.id)
      : null,
  });
  if (!matchBuckets.length) {
    throw serviceError('participating_matches_not_found', 404);
  }
  if (matchBuckets.length > MAX_MATCHES_PER_JOB) {
    throw serviceError('too_many_matches', 422, {
      max: MAX_MATCHES_PER_JOB,
    });
  }

  const expiresAt = new Date(Date.now() + EXPORT_TTL_MS);
  const job = await MatchProtocolExportJob.create({
    team_id: teamId,
    season_id: seasonId,
    requested_by_user_id: actorId,
    fingerprint: fp,
    selected_player_ids: selectedPlayerIds,
    selected_external_player_ids: externalIds,
    total_matches: matchBuckets.length,
    expires_at: expiresAt,
    created_by: actorId,
    updated_by: actorId,
  });

  await MatchProtocolExportItem.bulkCreate(
    matchBuckets.map(({ match, highlightedExternalIds }) => ({
      job_id: job.id,
      match_id: match.id,
      external_match_id: match.external_id || null,
      filename: buildPdfFilename(match),
      highlighted_external_player_ids: [...highlightedExternalIds],
      created_by: actorId,
      updated_by: actorId,
    }))
  );

  scheduleJob(job.id, requestId);
  return { ...serializeJob(job), already_running: false };
}

export async function getExportJob({ teamId, jobId, access }) {
  assertTeamAccess(teamId, access);
  const job = await MatchProtocolExportJob.findOne({
    where: { id: jobId, team_id: teamId },
  });
  if (!job) throw serviceError('export_job_not_found', 404);
  return serializeJob(job);
}

export async function downloadExportArchive({ teamId, jobId, access }) {
  assertTeamAccess(teamId, access);
  const job = await MatchProtocolExportJob.findOne({
    where: { id: jobId, team_id: teamId },
    include: [{ model: File, as: 'ArchiveFile', required: false }],
  });
  if (!job) throw serviceError('export_job_not_found', 404);
  if (new Date(job.expires_at).getTime() <= Date.now()) {
    throw serviceError('export_job_expired', 410);
  }
  if (job.status !== 'COMPLETED' || !job.ArchiveFile) {
    throw serviceError('export_job_not_ready', 409);
  }
  const buffer = await fileService.getFileBuffer(job.ArchiveFile);
  return {
    buffer,
    filename: job.ArchiveFile.original_name || `protocols-${job.id}.zip`,
  };
}

export default {
  createExportJob,
  getExportJob,
  downloadExportArchive,
  processExportJob,
};
