import { Op } from 'sequelize';

import { User, Team } from '../models/index.js';
import { Game, Team as ExtTeam, Stadium } from '../externalModels/index.js';
import { utcToMoscow, moscowToUtc } from '../utils/time.js';
import { extractFirstUrl } from '../utils/url.js';
import ServiceError from '../errors/ServiceError.js';

async function listUpcoming(userId, options) {
  // Backward-compat API: allow second arg to be a number (limit)
  const compatArrayReturn = typeof options !== 'object' || options === null;
  const opts = compatArrayReturn
    ? { limit: typeof options === 'number' ? options : undefined }
    : options;
  const { limit = 100, offset = 0, type = 'all', q = '' } = opts;
  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  const extIds = (user.Teams || [])
    .map((t) => t.external_id)
    .filter((id) => id != null);
  if (!extIds.length) return compatArrayReturn ? [] : { rows: [], count: 0 };
  // Upcoming: include all games from start of Moscow day (00:00 MSK) and later
  const now = new Date();
  const nowMsk = utcToMoscow(now) || now;
  const mskStart = new Date(
    Date.UTC(nowMsk.getUTCFullYear(), nowMsk.getUTCMonth(), nowMsk.getUTCDate())
  );
  const where = {
    object_status: { [Op.notIn]: ['archive', 'ARCHIVE'] },
    date_start: { [Op.gte]: mskStart },
  };
  if (type === 'home') {
    where.team1_id = { [Op.in]: extIds };
  } else if (type === 'away') {
    where.team2_id = { [Op.in]: extIds };
  } else {
    where[Op.or] = [
      { team1_id: { [Op.in]: extIds } },
      { team2_id: { [Op.in]: extIds } },
    ];
  }

  const search = (q || '').trim();
  const findOptions = {
    attributes: ['id', 'date_start', 'team1_id', 'team2_id', 'stadium_id'],
    where,
    include: [
      { model: ExtTeam, as: 'Team1', attributes: ['full_name'] },
      { model: ExtTeam, as: 'Team2', attributes: ['full_name'] },
      { model: Stadium, attributes: ['name'] },
    ],
    order: [['date_start', 'ASC']],
    distinct: true,
  };
  if (
    typeof offset === 'number' &&
    offset >= 0 &&
    typeof limit === 'number' &&
    limit > 0
  ) {
    findOptions.offset = offset;
    findOptions.limit = limit;
  }
  if (search) {
    findOptions.where[Op.and] = [
      {
        [Op.or]: [
          { '$Team1.full_name$': { [Op.like]: `%${search}%` } },
          { '$Team2.full_name$': { [Op.like]: `%${search}%` } },
        ],
      },
    ];
  }

  // Use findAll for compatibility with tests that mock only findAll
  const rowsRaw = await Game.findAll(findOptions);

  if (compatArrayReturn) {
    // Legacy/compat mode: return an array of simplified items
    return rowsRaw.map((g) => ({
      id: g.id,
      date: g.date_start,
      stadium: g.Stadium?.name || null,
      team1: g.Team1?.full_name || null,
      team2: g.Team2?.full_name || null,
      broadcast_links: [
        extractFirstUrl(g.broadcast),
        extractFirstUrl(g.broadcast2),
      ].filter(Boolean),
    }));
  }

  // Default/object mode: return rows + count, keeping previous shape
  // Attempt to compute total count; fall back to current page length
  let total = rowsRaw.length;
  if (typeof Game.count === 'function') {
    try {
      total = await Game.count({
        where: findOptions.where,
        distinct: true,
        col: 'id',
        include: findOptions.include,
      });
    } catch {
      // Ignore count errors and use page length
    }
  }

  return {
    rows: rowsRaw.map((g) => ({
      id: g.id,
      date: g.date_start,
      stadium: g.Stadium?.name || null,
      team1: g.Team1?.full_name || null,
      team2: g.Team2?.full_name || null,
      is_home: extIds.includes(Number(g.team1_id)),
      broadcast_links: [
        extractFirstUrl(g.broadcast),
        extractFirstUrl(g.broadcast2),
      ].filter(Boolean),
    })),
    count: total,
  };
}

export default { listUpcoming, listUpcomingLocal, listPast, listPastLocal };

// Local fallback: use imported matches when external DB is unavailable
async function listUpcomingLocal(userId, options) {
  // Lazy-load to keep tests (which mock models/index.js) happy without exporting Ground/Match
  const {
    Match,
    Ground,
    Tournament,
    TournamentGroup,
    Tour,
    MatchAgreement,
    MatchAgreementStatus,
    GameStatus,
    MatchBroadcastLink,
  } = await import('../models/index.js');
  const compatArrayReturn = typeof options !== 'object' || options === null;
  const opts = compatArrayReturn
    ? { limit: typeof options === 'number' ? options : undefined }
    : options;
  const { limit = 100, offset = 0, type = 'all', q = '' } = opts;

  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  const teamIds = (user.Teams || []).map((t) => t.id);
  if (!teamIds.length) return compatArrayReturn ? [] : { rows: [], count: 0 };

  const now = new Date();
  // Start of Moscow day in UTC
  const nowMsk = utcToMoscow(now) || now;
  const mskStart = new Date(
    Date.UTC(nowMsk.getUTCFullYear(), nowMsk.getUTCMonth(), nowMsk.getUTCDate())
  );
  const startUtc = moscowToUtc(mskStart) || mskStart;
  const where = { date_start: { [Op.gte]: startUtc } };
  if (type === 'home') where.team1_id = { [Op.in]: teamIds };
  else if (type === 'away') where.team2_id = { [Op.in]: teamIds };
  else
    where[Op.or] = [
      { team1_id: { [Op.in]: teamIds } },
      { team2_id: { [Op.in]: teamIds } },
    ];

  const findOptions = {
    attributes: [
      'id',
      'date_start',
      'team1_id',
      'team2_id',
      'ground_id',
      'score_team1',
      'score_team2',
      'scheduled_date',
    ],
    where,
    include: [
      { model: Team, as: 'HomeTeam', attributes: ['name'] },
      { model: Team, as: 'AwayTeam', attributes: ['name'] },
      { model: Ground, attributes: ['name'] },
      { model: GameStatus, attributes: ['name', 'alias'] },
      // enrich with competition meta
      { model: Tournament, attributes: ['name'] },
      { model: TournamentGroup, attributes: ['name'] },
      { model: Tour, attributes: ['name'] },
      { model: MatchBroadcastLink, attributes: ['url', 'position'] },
    ],
    order: [['date_start', 'ASC']],
    distinct: true,
  };
  if (
    typeof offset === 'number' &&
    offset >= 0 &&
    typeof limit === 'number' &&
    limit > 0
  ) {
    findOptions.offset = offset;
    findOptions.limit = limit;
  }

  const search = (q || '').trim();
  if (search) {
    findOptions.where[Op.and] = [
      {
        [Op.or]: [
          { '$HomeTeam.name$': { [Op.like]: `%${search}%` } },
          { '$AwayTeam.name$': { [Op.like]: `%${search}%` } },
          { '$Tournament.name$': { [Op.like]: `%${search}%` } },
          { '$TournamentGroup.name$': { [Op.like]: `%${search}%` } },
          { '$Tour.name$': { [Op.like]: `%${search}%` } },
        ],
      },
    ];
  }

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

  if (compatArrayReturn) {
    return rowsRaw.map((m) => ({
      id: m.id,
      date: m.date_start,
      scheduled_date: m.scheduled_date || null,
      stadium: m.Ground?.name || null,
      team1: m.HomeTeam?.name || null,
      team2: m.AwayTeam?.name || null,
      status: m.GameStatus
        ? { name: m.GameStatus.name, alias: m.GameStatus.alias }
        : null,
      tournament: m.Tournament?.name || null,
      group: m.TournamentGroup?.name || null,
      tour: m.Tour?.name || null,
      broadcast_links: (m.MatchBroadcastLinks || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((x) => x.url)
        .filter(Boolean),
    }));
  }

  let total = rowsRaw.length;
  if (typeof Match.count === 'function') {
    try {
      total = await Match.count({
        where: findOptions.where,
        distinct: true,
        col: 'id',
        include: findOptions.include,
      });
    } catch {
      /* empty */
    }
  }

  return {
    rows: rowsRaw.map((m) => {
      const flags = flagsByMatch.get(m.id) || {
        accepted: false,
        pending: false,
      };
      // Urgency: less than 7 days to kickoff in MSK, not accepted, and schedulable status
      const now = new Date();
      const mskNow = utcToMoscow(now) || now;
      const mskKickoff = utcToMoscow(m.date_start) || new Date(m.date_start);
      const diffMs = mskKickoff.getTime() - mskNow.getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const statusAlias = (m.GameStatus?.alias || '').toUpperCase();
      const isSchedulable =
        statusAlias !== 'CANCELLED' &&
        statusAlias !== 'FINISHED' &&
        statusAlias !== 'LIVE';
      const isUrgent =
        !flags.accepted && isSchedulable && diffMs >= 0 && diffMs < sevenDaysMs;
      return {
        id: m.id,
        date: m.date_start,
        stadium: m.Ground?.name || null,
        team1: m.HomeTeam?.name || null,
        team2: m.AwayTeam?.name || null,
        is_home: teamIds.includes(m.team1_id),
        score_team1: m.score_team1 ?? null,
        score_team2: m.score_team2 ?? null,
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
        broadcast_links: (m.MatchBroadcastLinks || [])
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((x) => x.url)
          .filter(Boolean),
      };
    }),
    count: total,
  };
}

export { listUpcomingLocal };

// Past matches: strictly before start of today (Moscow time)
async function listPast(userId, options) {
  const compatArrayReturn = typeof options !== 'object' || options === null;
  const opts = compatArrayReturn
    ? { limit: typeof options === 'number' ? options : undefined }
    : options;
  const { limit = 100, offset = 0, type = 'all', q = '' } = opts;
  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  const extIds = (user.Teams || [])
    .map((t) => t.external_id)
    .filter((id) => id != null);
  if (!extIds.length) return compatArrayReturn ? [] : { rows: [], count: 0 };

  const now = new Date();
  const nowMsk = utcToMoscow(now) || now;
  const mskStart = new Date(
    Date.UTC(nowMsk.getUTCFullYear(), nowMsk.getUTCMonth(), nowMsk.getUTCDate())
  );
  const where = {
    object_status: { [Op.notIn]: ['archive', 'ARCHIVE'] },
    date_start: { [Op.lt]: mskStart },
  };
  if (type === 'home') where.team1_id = { [Op.in]: extIds };
  else if (type === 'away') where.team2_id = { [Op.in]: extIds };
  else
    where[Op.or] = [
      { team1_id: { [Op.in]: extIds } },
      { team2_id: { [Op.in]: extIds } },
    ];

  const search = (q || '').trim();
  const findOptions = {
    attributes: ['id', 'date_start', 'team1_id', 'team2_id', 'stadium_id'],
    where,
    include: [
      { model: ExtTeam, as: 'Team1', attributes: ['full_name'] },
      { model: ExtTeam, as: 'Team2', attributes: ['full_name'] },
      { model: Stadium, attributes: ['name'] },
    ],
    order: [['date_start', 'DESC']],
    distinct: true,
  };
  if (
    typeof offset === 'number' &&
    offset >= 0 &&
    typeof limit === 'number' &&
    limit > 0
  ) {
    findOptions.offset = offset;
    findOptions.limit = limit;
  }
  if (search) {
    findOptions.where[Op.and] = [
      {
        [Op.or]: [
          { '$Team1.full_name$': { [Op.like]: `%${search}%` } },
          { '$Team2.full_name$': { [Op.like]: `%${search}%` } },
        ],
      },
    ];
  }

  const rowsRaw = await Game.findAll(findOptions);
  if (compatArrayReturn) {
    return rowsRaw.map((g) => ({
      id: g.id,
      date: g.date_start,
      stadium: g.Stadium?.name || null,
      team1: g.Team1?.full_name || null,
      team2: g.Team2?.full_name || null,
      score_team1: g.score_team1 ?? null,
      score_team2: g.score_team2 ?? null,
      broadcast_links: [
        extractFirstUrl(g.broadcast),
        extractFirstUrl(g.broadcast2),
      ].filter(Boolean),
    }));
  }
  let total = rowsRaw.length;
  if (typeof Game.count === 'function') {
    try {
      total = await Game.count({
        where: findOptions.where,
        distinct: true,
        col: 'id',
        include: findOptions.include,
      });
    } catch {
      // Fallback to found rows count if count() fails
      total = rowsRaw.length;
    }
  }
  return {
    rows: rowsRaw.map((g) => ({
      id: g.id,
      date: g.date_start,
      stadium: g.Stadium?.name || null,
      team1: g.Team1?.full_name || null,
      team2: g.Team2?.full_name || null,
      is_home: extIds.includes(Number(g.team1_id)),
      is_away: extIds.includes(Number(g.team2_id)),
      is_both_teams:
        extIds.includes(Number(g.team1_id)) &&
        extIds.includes(Number(g.team2_id)),
      score_team1: g.score_team1 ?? null,
      score_team2: g.score_team2 ?? null,
      broadcast_links: [
        extractFirstUrl(g.broadcast),
        extractFirstUrl(g.broadcast2),
      ].filter(Boolean),
    })),
    count: total,
  };
}

async function listPastLocal(userId, options) {
  const {
    Match,
    Ground,
    Tournament,
    TournamentGroup,
    Tour,
    GameStatus,
    MatchBroadcastLink,
  } = await import('../models/index.js');
  const compatArrayReturn = typeof options !== 'object' || options === null;
  const opts = compatArrayReturn
    ? { limit: typeof options === 'number' ? options : undefined }
    : options;
  const {
    limit = 100,
    offset = 0,
    type = 'all',
    q = '',
    seasonId = null,
  } = opts;

  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  const teamIds = (user.Teams || []).map((t) => t.id);
  if (!teamIds.length) return compatArrayReturn ? [] : { rows: [], count: 0 };

  const now = new Date();
  const nowMsk = utcToMoscow(now) || now;
  const mskStart = new Date(
    Date.UTC(nowMsk.getUTCFullYear(), nowMsk.getUTCMonth(), nowMsk.getUTCDate())
  );
  const startUtc = moscowToUtc(mskStart) || mskStart;
  const where = { date_start: { [Op.lt]: startUtc } };
  if (seasonId) where.season_id = seasonId;
  if (type === 'home') where.team1_id = { [Op.in]: teamIds };
  else if (type === 'away') where.team2_id = { [Op.in]: teamIds };
  else
    where[Op.or] = [
      { team1_id: { [Op.in]: teamIds } },
      { team2_id: { [Op.in]: teamIds } },
    ];

  const findOptions = {
    attributes: [
      'id',
      'date_start',
      'team1_id',
      'team2_id',
      'ground_id',
      'season_id',
      'score_team1',
      'score_team2',
      'scheduled_date',
    ],
    where,
    include: [
      { model: Team, as: 'HomeTeam', attributes: ['name'] },
      { model: Team, as: 'AwayTeam', attributes: ['name'] },
      { model: Ground, attributes: ['name'] },
      { model: GameStatus, attributes: ['name', 'alias'] },
      { model: Tournament, attributes: ['name'] },
      { model: TournamentGroup, attributes: ['name'] },
      { model: Tour, attributes: ['name'] },
      { model: MatchBroadcastLink, attributes: ['url', 'position'] },
    ],
    order: [['date_start', 'DESC']],
    distinct: true,
  };
  if (
    typeof offset === 'number' &&
    offset >= 0 &&
    typeof limit === 'number' &&
    limit > 0
  ) {
    findOptions.offset = offset;
    findOptions.limit = limit;
  }
  const search = (q || '').trim();
  if (search) {
    findOptions.where[Op.and] = [
      {
        [Op.or]: [
          { '$HomeTeam.name$': { [Op.like]: `%${search}%` } },
          { '$AwayTeam.name$': { [Op.like]: `%${search}%` } },
          { '$Tournament.name$': { [Op.like]: `%${search}%` } },
          { '$TournamentGroup.name$': { [Op.like]: `%${search}%` } },
          { '$Tour.name$': { [Op.like]: `%${search}%` } },
        ],
      },
    ];
  }
  const rowsRaw = await Match.findAll(findOptions);
  if (compatArrayReturn) {
    return rowsRaw.map((m) => ({
      id: m.id,
      date: m.date_start,
      scheduled_date: m.scheduled_date || null,
      stadium: m.Ground?.name || null,
      team1: m.HomeTeam?.name || null,
      team2: m.AwayTeam?.name || null,
      score_team1: m.score_team1 ?? null,
      score_team2: m.score_team2 ?? null,
      is_home: teamIds.includes(m.team1_id),
      is_away: teamIds.includes(m.team2_id),
      is_both_teams:
        teamIds.includes(m.team1_id) && teamIds.includes(m.team2_id),
      status: m.GameStatus
        ? { name: m.GameStatus.name, alias: m.GameStatus.alias }
        : null,
      tournament: m.Tournament?.name || null,
      group: m.TournamentGroup?.name || null,
      tour: m.Tour?.name || null,
      season_id: m.season_id || null,
      broadcast_links: (m.MatchBroadcastLinks || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((x) => x.url)
        .filter(Boolean),
    }));
  }
  let total = rowsRaw.length;
  if (typeof Match.count === 'function') {
    try {
      total = await Match.count({
        where: findOptions.where,
        distinct: true,
        col: 'id',
        include: findOptions.include,
      });
    } catch {
      // Fallback to found rows count if count() fails
      total = rowsRaw.length;
    }
  }
  return {
    rows: rowsRaw.map((m) => ({
      id: m.id,
      date: m.date_start,
      stadium: m.Ground?.name || null,
      team1: m.HomeTeam?.name || null,
      team2: m.AwayTeam?.name || null,
      tournament: m.Tournament?.name || null,
      group: m.TournamentGroup?.name || null,
      tour: m.Tour?.name || null,
      season_id: m.season_id || null,
      is_home: teamIds.includes(m.team1_id),
      is_away: teamIds.includes(m.team2_id),
      is_both_teams:
        teamIds.includes(m.team1_id) && teamIds.includes(m.team2_id),
      score_team1: m.score_team1 ?? null,
      score_team2: m.score_team2 ?? null,
      scheduled_date: m.scheduled_date || null,
      status: m.GameStatus
        ? { name: m.GameStatus.name, alias: m.GameStatus.alias }
        : null,
      broadcast_links: (m.MatchBroadcastLinks || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((x) => x.url)
        .filter(Boolean),
    })),
    count: total,
  };
}

export { listPast, listPastLocal };
