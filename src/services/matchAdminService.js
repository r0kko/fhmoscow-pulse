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
  TournamentGroup,
  Tour,
  MatchAgreement,
  MatchAgreementStatus,
  MatchAgreementType,
  GameStatus,
} from '../models/index.js';

import externalSync from './externalMatchSyncService.js';

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
      { model: Tournament, attributes: ['name'] },
      { model: TournamentGroup, attributes: ['name'] },
      { model: Tour, attributes: ['name'] },
      { model: GameStatus, attributes: ['name', 'alias'] },
    ],
    order: [['date_start', 'ASC']],
    distinct: true,
  };

  const search = (q || '').trim();
  const ands = [];
  const arrify = (v) =>
    Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter(Boolean)
      : String(v || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
  const homeList = [...arrify(homeClubs), ...arrify(homeClub)];
  const awayList = [...arrify(awayClubs), ...arrify(awayClub)];
  const tournList = [...arrify(tournaments), ...arrify(tournament)];
  const groupList = [...arrify(groups), ...arrify(groupName)];
  const stadList = [...arrify(stadiums), ...arrify(stadium)];
  if (search) {
    ands.push({
      [Op.or]: [
        { '$HomeTeam.name$': { [Op.like]: `%${search}%` } },
        { '$AwayTeam.name$': { [Op.like]: `%${search}%` } },
        { '$Tournament.name$': { [Op.like]: `%${search}%` } },
        { '$TournamentGroup.name$': { [Op.like]: `%${search}%` } },
        { '$Tour.name$': { [Op.like]: `%${search}%` } },
        { '$Ground.name$': { [Op.like]: `%${search}%` } },
        { '$HomeTeam.Club.name$': { [Op.like]: `%${search}%` } },
        { '$AwayTeam.Club.name$': { [Op.like]: `%${search}%` } },
      ],
    });
  }
  if (homeList.length)
    ands.push({ '$HomeTeam.Club.name$': { [Op.in]: homeList } });
  if (awayList.length)
    ands.push({ '$AwayTeam.Club.name$': { [Op.in]: awayList } });
  if (tournList.length)
    ands.push({ '$Tournament.name$': { [Op.in]: tournList } });
  if (groupList.length)
    ands.push({ '$TournamentGroup.name$': { [Op.in]: groupList } });
  if (stadList.length) ands.push({ '$Ground.name$': { [Op.in]: stadList } });
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
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const matches = rowsRaw.map((m) => {
    const flags = flagsByMatch.get(m.id) || { accepted: false, pending: false };
    const mskKickoff = utcToMoscow(m.date_start) || new Date(m.date_start);
    const statusAlias = (m.GameStatus?.alias || '').toUpperCase();
    const isSchedulable =
      statusAlias !== 'CANCELLED' &&
      statusAlias !== 'FINISHED' &&
      statusAlias !== 'LIVE';
    const isUrgent =
      !flags.accepted &&
      isSchedulable &&
      mskKickoff.getTime() >= nowMskTs &&
      mskKickoff.getTime() - nowMskTs < sevenDaysMs;
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
      status: m.GameStatus
        ? { name: m.GameStatus.name, alias: m.GameStatus.alias }
        : null,
      agreement_accepted: !!flags.accepted,
      agreement_pending: !!flags.pending && !flags.accepted,
      urgent_unagreed: isUrgent,
    };
  });

  return {
    matches,
    range: {
      start: startUtc.toISOString(),
      end_exclusive: endUtcExclusive.toISOString(),
    },
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
} = {}) {
  const now = new Date();
  const nowMsk = utcToMoscow(now) || now;
  const startMsk = new Date(
    Date.UTC(nowMsk.getUTCFullYear(), nowMsk.getUTCMonth(), nowMsk.getUTCDate())
  );
  const startUtc = moscowToUtc(startMsk) || startMsk;
  const endMskExclusive = new Date(
    startMsk.getTime() + horizonDays * 24 * 60 * 60 * 1000
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
      { model: Tournament, attributes: ['name'] },
      { model: TournamentGroup, attributes: ['name'] },
      { model: Tour, attributes: ['name'] },
      { model: GameStatus, attributes: ['name', 'alias'] },
    ],
    order: [['date_start', 'ASC']],
    distinct: true,
  };

  const search = (q || '').trim();
  const ands = [];
  const arrify = (v) =>
    Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter(Boolean)
      : String(v || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
  const homeList = [...arrify(homeClubs), ...arrify(homeClub)];
  const awayList = [...arrify(awayClubs), ...arrify(awayClub)];
  const tournList = [...arrify(tournaments), ...arrify(tournament)];
  const groupList = [...arrify(groups), ...arrify(groupName)];
  const stadList = [...arrify(stadiums), ...arrify(stadium)];
  if (search) {
    ands.push({
      [Op.or]: [
        { '$HomeTeam.name$': { [Op.like]: `%${search}%` } },
        { '$AwayTeam.name$': { [Op.like]: `%${search}%` } },
        { '$Tournament.name$': { [Op.like]: `%${search}%` } },
        { '$TournamentGroup.name$': { [Op.like]: `%${search}%` } },
        { '$Tour.name$': { [Op.like]: `%${search}%` } },
        { '$Ground.name$': { [Op.like]: `%${search}%` } },
        { '$HomeTeam.Club.name$': { [Op.like]: `%${search}%` } },
        { '$AwayTeam.Club.name$': { [Op.like]: `%${search}%` } },
      ],
    });
  }
  if (homeList.length)
    ands.push({ '$HomeTeam.Club.name$': { [Op.in]: homeList } });
  if (awayList.length)
    ands.push({ '$AwayTeam.Club.name$': { [Op.in]: awayList } });
  if (tournList.length)
    ands.push({ '$Tournament.name$': { [Op.in]: tournList } });
  if (groupList.length)
    ands.push({ '$TournamentGroup.name$': { [Op.in]: groupList } });
  if (stadList.length) ands.push({ '$Ground.name$': { [Op.in]: stadList } });
  if (ands.length) findOptions.where[Op.and] = ands;

  const rowsRaw = await Match.findAll(findOptions);

  // Determine first `count` distinct Moscow dates having matches
  const byDayKey = new Map();
  for (const m of rowsRaw) {
    const msk = utcToMoscow(m.date_start) || new Date(m.date_start);
    const key = Date.UTC(
      msk.getUTCFullYear(),
      msk.getUTCMonth(),
      msk.getUTCDate()
    );
    if (!byDayKey.has(key)) byDayKey.set(key, []);
    byDayKey.get(key).push(m);
  }
  const keys = [...byDayKey.keys()]
    .sort((a, b) => a - b)
    .slice(0, Math.max(1, count));
  const selected = keys.flatMap((k) => byDayKey.get(k) || []);

  // Enrich with agreement flags for selected matches only
  const matchIds = selected.map((m) => m.id);
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
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const matches = selected.map((m) => {
    const flags = flagsByMatch.get(m.id) || { accepted: false, pending: false };
    const mskKickoff = utcToMoscow(m.date_start) || new Date(m.date_start);
    const statusAlias = (m.GameStatus?.alias || '').toUpperCase();
    const isSchedulable =
      statusAlias !== 'CANCELLED' &&
      statusAlias !== 'FINISHED' &&
      statusAlias !== 'LIVE';
    const isUrgent =
      !flags.accepted &&
      isSchedulable &&
      mskKickoff.getTime() >= nowMskTs &&
      mskKickoff.getTime() - nowMskTs < sevenDaysMs;
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
      status: m.GameStatus
        ? { name: m.GameStatus.name, alias: m.GameStatus.alias }
        : null,
      agreement_accepted: !!flags.accepted,
      agreement_pending: !!flags.pending && !flags.accepted,
      urgent_unagreed: isUrgent,
    };
  });

  return {
    matches,
    range: {
      start: startUtc.toISOString(),
      end_exclusive: endUtcExclusive.toISOString(),
    },
    game_days: keys.map((k) => new Date(k).toISOString()),
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
