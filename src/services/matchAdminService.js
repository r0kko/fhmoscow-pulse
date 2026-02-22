import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';
import { utcToMoscow, moscowToUtc } from '../utils/time.js';
import {
  Match,
  Team,
  Club,
  Ground,
  Tournament,
  ScheduleManagementType,
  TournamentGroup,
  Tour,
  MatchAgreement,
  MatchAgreementStatus,
  MatchAgreementType,
  GameStatus,
} from '../models/index.js';
import { isAgreementsBlockedBySchedule } from '../utils/scheduleManagement.js';

import externalSync from './externalMatchSyncService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTENTION_DAYS = 7;
const ATTENTION_WINDOW_MS = ATTENTION_DAYS * DAY_MS;
export const CALENDAR_SEARCH_MAX_LEN = 80;
export const CALENDAR_MIN_SEARCH_LEN = 2;

function toMoscowDayKey(value) {
  const msk = utcToMoscow(value) || new Date(value);
  if (Number.isNaN(msk.getTime())) return null;
  return Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate());
}

function startOfMoscowDay(value) {
  const base = value ? new Date(value) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const msk = utcToMoscow(base) || base;
  return new Date(
    Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate())
  );
}

function normalizeDirection(raw) {
  const dir = String(raw || '').toLowerCase();
  if (dir === 'backward' || dir === 'both') return dir;
  return 'forward';
}

function arrify(v) {
  return Array.isArray(v)
    ? v.map((x) => String(x).trim()).filter(Boolean)
    : String(v || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
}

function isSchedulableStatus(aliasRaw) {
  const alias = String(aliasRaw || '').toUpperCase();
  return alias !== 'CANCELLED' && alias !== 'FINISHED' && alias !== 'LIVE';
}

function computeAttentionState({
  agreementsAllowed,
  accepted,
  pending,
  kickoffMs,
  nowMs,
  statusAlias,
}) {
  if (!agreementsAllowed || accepted) {
    return { needsAttention: false, urgentUnagreed: false };
  }
  if (!isSchedulableStatus(statusAlias)) {
    return { needsAttention: false, urgentUnagreed: false };
  }
  const soon =
    Number.isFinite(kickoffMs) &&
    kickoffMs >= nowMs &&
    kickoffMs - nowMs < ATTENTION_WINDOW_MS;
  return {
    needsAttention: Boolean(pending || soon),
    urgentUnagreed: Boolean(soon),
  };
}

function buildDayTabs(matches = []) {
  const byDay = new Map();
  for (const match of matches) {
    const key = toMoscowDayKey(match?.date);
    if (key == null) continue;
    const current = byDay.get(key) || { count: 0, attention_count: 0 };
    current.count += 1;
    if (match?.needs_attention) current.attention_count += 1;
    byDay.set(key, current);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day_key, value]) => ({
      day_key,
      count: value.count,
      attention_count: value.attention_count,
    }));
}

function mapCalendarMatches(rows, flagsByMatch, nowMskTs) {
  return rows.map((m) => {
    const flags = flagsByMatch.get(m.id) || { accepted: false, pending: false };
    const agreementsAllowed = !isAgreementsBlockedBySchedule(m);
    const effectiveFlags = agreementsAllowed
      ? flags
      : { accepted: false, pending: false };
    const accepted = Boolean(effectiveFlags.accepted);
    const pending = Boolean(effectiveFlags.pending) && !accepted;
    const kickoffMs = (
      utcToMoscow(m.date_start) || new Date(m.date_start)
    ).getTime();
    const statusAlias = (m.GameStatus?.alias || '').toUpperCase();
    const attention = computeAttentionState({
      agreementsAllowed,
      accepted,
      pending,
      kickoffMs,
      nowMs: nowMskTs,
      statusAlias,
    });
    return {
      id: m.id,
      date: m.date_start,
      stadium: m.Ground?.name || null,
      team1: m.HomeTeam?.name || null,
      team2: m.AwayTeam?.name || null,
      home_club: m.HomeTeam?.Club?.name || null,
      away_club: m.AwayTeam?.Club?.name || null,
      tournament: m.Tournament?.name || null,
      group: m.TournamentGroup?.name || null,
      tour: m.Tour?.name || null,
      scheduled_date: m.scheduled_date || null,
      score_team1: m.score_team1 ?? null,
      score_team2: m.score_team2 ?? null,
      technical_winner: m.technical_winner || null,
      status: m.GameStatus
        ? { name: m.GameStatus.name, alias: m.GameStatus.alias }
        : null,
      agreement_accepted: accepted,
      agreement_pending: pending,
      needs_attention: attention.needsAttention,
      urgent_unagreed: attention.urgentUnagreed,
      agreements_allowed: agreementsAllowed,
    };
  });
}

function getCalendarMeta(direction = 'forward') {
  return {
    attention_days: ATTENTION_DAYS,
    search_max_len: CALENDAR_SEARCH_MAX_LEN,
    direction: normalizeDirection(direction),
  };
}

function buildCalendarAndFilters({
  q = '',
  homeClubs = [],
  awayClubs = [],
  tournaments = [],
  groups = [],
  stadiums = [],
  homeClub = '',
  awayClub = '',
  tournament = '',
  groupName = '',
  stadium = '',
}) {
  const search = (q || '').trim();
  const useSearch = search.length >= CALENDAR_MIN_SEARCH_LEN;
  const ands = [];
  const includeNeeds = {
    home: false,
    away: false,
    tournament: false,
    group: false,
    tour: false,
    ground: false,
  };
  const homeList = [...arrify(homeClubs), ...arrify(homeClub)];
  const awayList = [...arrify(awayClubs), ...arrify(awayClub)];
  const tournList = [...arrify(tournaments), ...arrify(tournament)];
  const groupList = [...arrify(groups), ...arrify(groupName)];
  const stadList = [...arrify(stadiums), ...arrify(stadium)];
  if (useSearch) {
    includeNeeds.home = true;
    includeNeeds.away = true;
    includeNeeds.tournament = true;
    includeNeeds.group = true;
    includeNeeds.tour = true;
    includeNeeds.ground = true;
    ands.push({
      [Op.or]: [
        { '$HomeTeam.name$': { [Op.iLike]: `%${search}%` } },
        { '$AwayTeam.name$': { [Op.iLike]: `%${search}%` } },
        { '$Tournament.name$': { [Op.iLike]: `%${search}%` } },
        { '$TournamentGroup.name$': { [Op.iLike]: `%${search}%` } },
        { '$Tour.name$': { [Op.iLike]: `%${search}%` } },
        { '$Ground.name$': { [Op.iLike]: `%${search}%` } },
        { '$HomeTeam.Club.name$': { [Op.iLike]: `%${search}%` } },
        { '$AwayTeam.Club.name$': { [Op.iLike]: `%${search}%` } },
      ],
    });
  }
  if (homeList.length) {
    includeNeeds.home = true;
    ands.push({ '$HomeTeam.Club.name$': { [Op.in]: homeList } });
  }
  if (awayList.length) {
    includeNeeds.away = true;
    ands.push({ '$AwayTeam.Club.name$': { [Op.in]: awayList } });
  }
  if (tournList.length) {
    includeNeeds.tournament = true;
    ands.push({ '$Tournament.name$': { [Op.in]: tournList } });
  }
  if (groupList.length) {
    includeNeeds.group = true;
    ands.push({ '$TournamentGroup.name$': { [Op.in]: groupList } });
  }
  if (stadList.length) {
    includeNeeds.ground = true;
    ands.push({ '$Ground.name$': { [Op.in]: stadList } });
  }
  return { ands, includeNeeds };
}

function buildLightCalendarInclude(includeNeeds) {
  const include = [];
  if (includeNeeds.home) {
    include.push({
      model: Team,
      as: 'HomeTeam',
      attributes: [],
      include: [{ model: Club, attributes: [] }],
    });
  }
  if (includeNeeds.away) {
    include.push({
      model: Team,
      as: 'AwayTeam',
      attributes: [],
      include: [{ model: Club, attributes: [] }],
    });
  }
  if (includeNeeds.ground) include.push({ model: Ground, attributes: [] });
  if (includeNeeds.tournament)
    include.push({ model: Tournament, attributes: [] });
  if (includeNeeds.group)
    include.push({ model: TournamentGroup, attributes: [] });
  if (includeNeeds.tour) include.push({ model: Tour, attributes: [] });
  return include;
}

/**
 * List matches for the next N days (Moscow time), enriched with agreement flags.
 * Admin scope: returns all matches in the range.
 *
 * @param {object} options
 * @param {number} [options.days=10] Number of days starting today (>=1)
 * @param {string} [options.q] Optional search string (team/tournament/group/tour)
 */
export async function listNextDays({
  days = 10,
  q = '',
  homeClubs = [],
  awayClubs = [],
  tournaments = [],
  groups = [],
  stadiums = [],
  // backward-compat single-value aliases
  homeClub = '',
  awayClub = '',
  tournament = '',
  groupName = '',
  stadium = '',
} = {}) {
  const now = new Date();
  const nowMsk = utcToMoscow(now) || now;
  const startMsk = new Date(
    Date.UTC(nowMsk.getUTCFullYear(), nowMsk.getUTCMonth(), nowMsk.getUTCDate())
  );
  const startUtc = moscowToUtc(startMsk) || startMsk;
  // End bound is start of day after the last day
  const endMskExclusive = new Date(
    startMsk.getTime() + days * 24 * 60 * 60 * 1000
  );
  const endUtcExclusive = moscowToUtc(endMskExclusive) || endMskExclusive;

  const where = {
    date_start: { [Op.gte]: startUtc, [Op.lt]: endUtcExclusive },
  };

  const findOptions = {
    attributes: [
      'id',
      'date_start',
      'team1_id',
      'team2_id',
      'ground_id',
      'tournament_id',
      'tournament_group_id',
      'tour_id',
      'scheduled_date',
      'score_team1',
      'score_team2',
      'technical_winner',
    ],
    where,
    include: [
      {
        model: Team,
        as: 'HomeTeam',
        attributes: ['name'],
        include: [{ model: Club, attributes: ['name'] }],
      },
      {
        model: Team,
        as: 'AwayTeam',
        attributes: ['name'],
        include: [{ model: Club, attributes: ['name'] }],
      },
      { model: Ground, attributes: ['name'] },
      {
        model: Tournament,
        attributes: ['name'],
        include: [{ model: ScheduleManagementType, attributes: ['alias'] }],
      },
      { model: TournamentGroup, attributes: ['name'] },
      { model: Tour, attributes: ['name'] },
      { model: GameStatus, attributes: ['name', 'alias'] },
    ],
    order: [['date_start', 'ASC']],
    distinct: true,
  };

  const { ands } = buildCalendarAndFilters({
    q,
    homeClubs,
    awayClubs,
    tournaments,
    groups,
    stadiums,
    homeClub,
    awayClub,
    tournament,
    groupName,
    stadium,
  });
  if (ands.length) findOptions.where[Op.and] = ands;

  const rowsRaw = await Match.findAll(findOptions);

  // Enrich with agreement status flags in a single query for all matches in page
  const matchIds = rowsRaw.map((m) => m.id);
  const flagsByMatch = new Map();
  if (matchIds.length) {
    const agrs = await MatchAgreement.findAll({
      attributes: ['match_id'],
      where: { match_id: { [Op.in]: matchIds } },
      include: [
        {
          model: MatchAgreementStatus,
          attributes: ['alias'],
          required: true,
          where: { alias: { [Op.in]: ['ACCEPTED', 'PENDING'] } },
        },
      ],
    });
    for (const a of agrs) {
      const id = a.match_id;
      const alias = a.MatchAgreementStatus?.alias;
      if (!flagsByMatch.has(id))
        flagsByMatch.set(id, { accepted: false, pending: false });
      const flags = flagsByMatch.get(id);
      if (alias === 'ACCEPTED') flags.accepted = true;
      if (alias === 'PENDING') flags.pending = true;
    }
  }

  const nowMskTs = (utcToMoscow(new Date()) || new Date()).getTime();
  const matches = mapCalendarMatches(rowsRaw, flagsByMatch, nowMskTs);
  const day_tabs = buildDayTabs(matches);

  return {
    matches,
    range: {
      start: startUtc.toISOString(),
      end_exclusive: endUtcExclusive.toISOString(),
    },
    day_tabs,
    meta: getCalendarMeta('forward'),
  };
}

/**
 * Return matches from the next horizonDays calendar days, but only for the first
 * `count` distinct Moscow dates that have any matches ("game days").
 */
export async function listNextGameDays({
  count = 10,
  horizonDays = 45,
  q = '',
  homeClubs = [],
  awayClubs = [],
  tournaments = [],
  groups = [],
  stadiums = [],
  // backward-compat single-value aliases
  homeClub = '',
  awayClub = '',
  tournament = '',
  groupName = '',
  stadium = '',
  direction = 'forward',
  anchorDate = null,
} = {}) {
  const anchorStart =
    startOfMoscowDay(anchorDate) || startOfMoscowDay(new Date()) || new Date();
  const normalizedDirection = normalizeDirection(direction);
  const spanDays = Math.max(horizonDays, count);

  let rangeStartMsk;
  let rangeEndMskExclusive;
  if (normalizedDirection === 'backward') {
    rangeEndMskExclusive = new Date(anchorStart.getTime() + DAY_MS);
    rangeStartMsk = new Date(
      rangeEndMskExclusive.getTime() - spanDays * DAY_MS
    );
  } else if (normalizedDirection === 'both') {
    rangeStartMsk = new Date(anchorStart.getTime() - spanDays * DAY_MS);
    rangeEndMskExclusive = new Date(
      anchorStart.getTime() + (spanDays + 1) * DAY_MS
    );
  } else {
    rangeStartMsk = anchorStart;
    rangeEndMskExclusive = new Date(anchorStart.getTime() + spanDays * DAY_MS);
  }

  const where = {
    date_start: {
      [Op.gte]: moscowToUtc(rangeStartMsk) || rangeStartMsk,
      [Op.lt]: moscowToUtc(rangeEndMskExclusive) || rangeEndMskExclusive,
    },
  };

  const { ands, includeNeeds } = buildCalendarAndFilters({
    q,
    homeClubs,
    awayClubs,
    tournaments,
    groups,
    stadiums,
    homeClub,
    awayClub,
    tournament,
    groupName,
    stadium,
  });

  const lightFindOptions = {
    attributes: ['id', 'date_start'],
    where,
    include: buildLightCalendarInclude(includeNeeds),
    order: [['date_start', 'ASC']],
    distinct: true,
    subQuery: false,
  };
  if (ands.length) lightFindOptions.where[Op.and] = ands;

  const rowsLight = await Match.findAll(lightFindOptions);

  const byDayKey = new Map();
  for (const m of rowsLight) {
    const msk = utcToMoscow(m.date_start) || new Date(m.date_start);
    const key = Date.UTC(
      msk.getUTCFullYear(),
      msk.getUTCMonth(),
      msk.getUTCDate()
    );
    if (!byDayKey.has(key)) byDayKey.set(key, []);
    byDayKey.get(key).push(m.id);
  }

  const allKeysAsc = [...byDayKey.keys()].sort((a, b) => a - b);
  const anchorKey = anchorStart.getTime();
  const desiredCount = Math.max(1, count);

  let keys;
  if (allKeysAsc.length === 0) {
    keys = [];
  } else if (normalizedDirection === 'backward') {
    const eligible = allKeysAsc.filter((k) => k <= anchorKey);
    const source = eligible.length ? eligible : allKeysAsc;
    keys = source.slice(-desiredCount);
  } else if (normalizedDirection === 'both') {
    const withDistances = allKeysAsc.map((k) => ({
      key: k,
      dist: Math.abs(k - anchorKey),
    }));
    withDistances.sort((a, b) => {
      if (a.dist === b.dist) return a.key - b.key;
      return a.dist - b.dist;
    });
    keys = withDistances.slice(0, desiredCount).map((item) => item.key);
    keys.sort((a, b) => a - b);
  } else {
    const eligible = allKeysAsc.filter((k) => k >= anchorKey);
    const source = eligible.length ? eligible : allKeysAsc;
    keys = source.slice(0, desiredCount);
  }

  const selectedIds = keys.flatMap((k) => byDayKey.get(k) || []);
  const matchIds = [...new Set(selectedIds)];
  let selected = [];
  if (matchIds.length) {
    const detailedRows = await Match.findAll({
      attributes: [
        'id',
        'date_start',
        'team1_id',
        'team2_id',
        'ground_id',
        'tournament_id',
        'tournament_group_id',
        'tour_id',
        'score_team1',
        'score_team2',
        'technical_winner',
      ],
      where: { id: { [Op.in]: matchIds } },
      include: [
        {
          model: Team,
          as: 'HomeTeam',
          attributes: ['name'],
          include: [{ model: Club, attributes: ['name'] }],
        },
        {
          model: Team,
          as: 'AwayTeam',
          attributes: ['name'],
          include: [{ model: Club, attributes: ['name'] }],
        },
        { model: Ground, attributes: ['name'] },
        {
          model: Tournament,
          attributes: ['name'],
          include: [{ model: ScheduleManagementType, attributes: ['alias'] }],
        },
        { model: TournamentGroup, attributes: ['name'] },
        { model: Tour, attributes: ['name'] },
        { model: GameStatus, attributes: ['name', 'alias'] },
      ],
      order: [['date_start', 'ASC']],
      distinct: true,
    });
    const byId = new Map(detailedRows.map((row) => [row.id, row]));
    selected = matchIds.map((id) => byId.get(id)).filter(Boolean);
  }

  // Enrich with agreement flags for selected matches only
  const flagsByMatch = new Map();
  if (matchIds.length) {
    const agrs = await MatchAgreement.findAll({
      attributes: ['match_id'],
      where: { match_id: { [Op.in]: matchIds } },
      include: [
        {
          model: MatchAgreementStatus,
          attributes: ['alias'],
          required: true,
          where: { alias: { [Op.in]: ['ACCEPTED', 'PENDING'] } },
        },
      ],
    });
    for (const a of agrs) {
      const id = a.match_id;
      const alias = a.MatchAgreementStatus?.alias;
      if (!flagsByMatch.has(id))
        flagsByMatch.set(id, { accepted: false, pending: false });
      const flags = flagsByMatch.get(id);
      if (alias === 'ACCEPTED') flags.accepted = true;
      if (alias === 'PENDING') flags.pending = true;
    }
  }

  const nowMskTs = (utcToMoscow(new Date()) || new Date()).getTime();
  const matches = mapCalendarMatches(selected, flagsByMatch, nowMskTs);
  const day_tabs = buildDayTabs(matches);

  return {
    matches,
    range: {
      start: (moscowToUtc(rangeStartMsk) || rangeStartMsk).toISOString(),
      end_exclusive: (
        moscowToUtc(rangeEndMskExclusive) || rangeEndMskExclusive
      ).toISOString(),
    },
    game_days: keys.map((k) => new Date(k).toISOString()),
    day_tabs,
    meta: getCalendarMeta(normalizedDirection),
  };
}

export default { listNextDays, listNextGameDays };

/**
 * Admin: set match kickoff (UTC ISO) and ground, lock schedule against club changes, and sync to external DB.
 * @param {Object} params
 * @param {string} params.matchId
 * @param {string|Date} params.dateStart - ISO string (UTC) or Date
 * @param {string} params.groundId - UUID
 * @param {string} params.actorId - admin user ID
 */
export async function updateScheduleAndLock({
  matchId,
  dateStart,
  groundId,
  actorId,
}) {
  const match = await Match.findByPk(matchId);
  if (!match) throw new ServiceError('match_not_found', 404);
  const ground = await Ground.findByPk(groundId);
  if (!ground) throw new ServiceError('ground_not_found', 404);

  const kickoff = dateStart instanceof Date ? dateStart : new Date(dateStart);
  if (!kickoff || Number.isNaN(kickoff.getTime()))
    throw new ServiceError('invalid_kickoff_time', 400);

  // Prevent scheduling in the past
  if (kickoff.getTime() <= Date.now())
    throw new ServiceError('kickoff_must_be_in_future', 400);

  // Pre-validate external sync before committing local changes
  try {
    await externalSync.syncApprovedMatchToExternal({
      matchId,
      groundId,
      dateStart: kickoff,
    });
  } catch (err) {
    const code =
      err?.code === 'EXTERNAL_DB_UNAVAILABLE'
        ? 'external_db_unavailable'
        : 'external_sync_failed';
    throw new ServiceError(code, 502);
  }

  // Local transaction: update match and supersede any pending agreements
  await sequelize.transaction(async (tx) => {
    // Ensure game status is SCHEDULED after admin assignment
    let scheduledStatusId;
    try {
      const scheduled = await GameStatus.findOne({
        where: { alias: 'SCHEDULED' },
        attributes: ['id'],
        transaction: tx,
      });
      scheduledStatusId = scheduled?.id || null;
    } catch {
      scheduledStatusId = null;
    }

    // Do not override a definitive external status (CANCELLED/POSTPONED/LIVE/FINISHED)
    const keepStatusId = match.game_status_id || null;
    try {
      if (match.game_status_id) {
        const current = await GameStatus.findByPk(match.game_status_id, {
          attributes: ['alias'],
          transaction: tx,
        });
        const alias = (current?.alias || '').toUpperCase();
        const isDefinitive =
          alias === 'CANCELLED' ||
          alias === 'POSTPONED' ||
          alias === 'FINISHED' ||
          alias === 'LIVE';
        if (isDefinitive) scheduledStatusId = null; // keep external-driven status
      }
    } catch {
      /* ignore */
    }
    await match.update(
      {
        date_start: kickoff,
        ground_id: groundId,
        schedule_locked_by_admin: true,
        game_status_id: scheduledStatusId ?? keepStatusId ?? null,
        // snapshot Moscow date-only if not set yet
        scheduled_date:
          match.scheduled_date ||
          (kickoff
            ? (() => {
                const msk = utcToMoscow(kickoff) || kickoff;
                const y = msk.getUTCFullYear();
                const m = String(msk.getUTCMonth() + 1).padStart(2, '0');
                const d = String(msk.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
              })()
            : null),
        updated_by: actorId,
      },
      { transaction: tx }
    );

    // Mark all pending agreements as SUPERSEDED to reflect admin override
    const pending = await MatchAgreementStatus.findOne({
      where: { alias: 'PENDING' },
      attributes: ['id'],
      transaction: tx,
    });
    const superseded = await MatchAgreementStatus.findOne({
      where: { alias: 'SUPERSEDED' },
      attributes: ['id'],
      transaction: tx,
    });
    if (pending && superseded) {
      await MatchAgreement.update(
        { status_id: superseded.id, updated_by: actorId },
        { where: { match_id: matchId, status_id: pending.id }, transaction: tx }
      );
    }

    // Append explicit timeline event: admin override (use ACCEPTED status for parity)
    const adminType = await MatchAgreementType.findOne({
      where: { alias: 'ADMIN_OVERRIDE' },
      attributes: ['id'],
      transaction: tx,
    });
    const accepted = await MatchAgreementStatus.findOne({
      where: { alias: 'ACCEPTED' },
      attributes: ['id'],
      transaction: tx,
    });
    if (adminType && accepted) {
      await MatchAgreement.create(
        {
          match_id: matchId,
          type_id: adminType.id,
          status_id: accepted.id,
          author_user_id: actorId,
          ground_id: groundId,
          date_start: kickoff,
          parent_id: null,
          created_by: actorId,
          updated_by: actorId,
        },
        { transaction: tx }
      );
    }
  });

  return { ok: true };
}
