import { Op } from 'sequelize';

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
} from '../models/index.js';

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
    const isUrgent =
      !flags.accepted &&
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
    const isUrgent =
      !flags.accepted &&
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
