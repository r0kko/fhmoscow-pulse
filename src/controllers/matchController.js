import service, { listUpcomingLocal } from '../services/matchService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import {
  resolveMatchAccessContext,
  evaluateStaffMatchRestrictions,
  buildPermissionPayload,
} from '../utils/matchAccess.js';

async function listUpcoming(req, res, next) {
  try {
    const all = String(req.query.all || '').toLowerCase() === 'true';
    const limit = all ? null : Math.max(1, parseInt(req.query.limit, 10) || 20);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const type = ['home', 'away'].includes(String(req.query.type))
      ? String(req.query.type)
      : 'all';
    const q = (req.query.q || '').toString();
    const forceLocal = String(req.query.source || '').toLowerCase() === 'local';

    const external = isExternalDbAvailable();
    if (external && !forceLocal) {
      const { rows, count } = await service.listUpcoming(req.user.id, {
        limit: limit ?? undefined,
        offset: limit ? (page - 1) * limit : undefined,
        type,
        q,
      });
      const totalPages = all ? 1 : Math.max(1, Math.ceil(count / (limit || 1)));
      return res.json({
        matches: rows,
        page,
        total_pages: totalPages,
        external_available: true,
      });
    }

    // Fallback to local imported matches
    const { rows, count } = await listUpcomingLocal(req.user.id, {
      limit: limit ?? undefined,
      offset: limit ? (page - 1) * limit : undefined,
      type,
      q,
    });
    const totalPages = all ? 1 : Math.max(1, Math.ceil(count / (limit || 1)));
    return res.json({
      matches: rows,
      page,
      total_pages: totalPages,
      external_available: false,
    });
  } catch (e) {
    next(e);
  }
}

async function listPast(req, res, next) {
  try {
    const all = String(req.query.all || '').toLowerCase() === 'true';
    const limit = all ? null : Math.max(1, parseInt(req.query.limit, 10) || 20);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const type = ['home', 'away'].includes(String(req.query.type))
      ? String(req.query.type)
      : 'all';
    const q = (req.query.q || '').toString();
    const forceLocal = String(req.query.source || '').toLowerCase() === 'local';
    const seasonId = req.query.season_id || null;

    const external = isExternalDbAvailable();
    if (external && !forceLocal) {
      const { rows, count } = await service.listPast(req.user.id, {
        limit: limit ?? undefined,
        offset: limit ? (page - 1) * limit : undefined,
        type,
        q,
      });
      const totalPages = all ? 1 : Math.max(1, Math.ceil(count / (limit || 1)));
      return res.json({
        matches: rows,
        page,
        total_pages: totalPages,
        external_available: true,
      });
    }

    const { rows, count } = await service.listPastLocal(req.user.id, {
      limit: limit ?? undefined,
      offset: limit ? (page - 1) * limit : undefined,
      type,
      q,
      seasonId,
    });
    const totalPages = all ? 1 : Math.max(1, Math.ceil(count / (limit || 1)));
    return res.json({
      matches: rows,
      page,
      total_pages: totalPages,
      external_available: false,
    });
  } catch (e) {
    next(e);
  }
}

export default { listUpcoming, listPast };
export { listPast };

export async function get(req, res, next) {
  try {
    const {
      Match,
      Team,
      Ground,
      Tournament,
      TournamentGroup,
      Tour,
      Season,
      Stage,
      Address,
      TournamentType,
      Club,
      GameStatus,
      MatchBroadcastLink,
    } = await import('../models/index.js');
    const m = await Match.findByPk(req.params.id, {
      attributes: [
        'id',
        'date_start',
        'ground_id',
        'team1_id',
        'team2_id',
        'season_id',
        'stage_id',
        'technical_winner',
        'score_team1',
        'score_team2',
        'schedule_locked_by_admin',
        'scheduled_date',
      ],
      include: [
        {
          model: Team,
          as: 'HomeTeam',
          attributes: ['name', 'club_id'],
          include: [{ model: Club, attributes: ['id', 'name', 'is_moscow'] }],
        },
        {
          model: Team,
          as: 'AwayTeam',
          attributes: ['name', 'club_id'],
          include: [{ model: Club, attributes: ['id', 'name', 'is_moscow'] }],
        },
        {
          model: Ground,
          attributes: ['id', 'name', 'yandex_url'],
          include: [
            {
              model: Address,
              attributes: ['result', 'metro', 'geo_lat', 'geo_lon'],
            },
          ],
        },
        {
          model: Tournament,
          attributes: ['name', 'type_id'],
          include: [{ model: TournamentType, attributes: ['double_protocol'] }],
        },
        { model: Stage, attributes: ['name'] },
        { model: TournamentGroup, attributes: ['name'] },
        { model: Tour, attributes: ['name'] },
        { model: Season, attributes: ['name', 'active'] },
        { model: GameStatus, attributes: ['name', 'alias'] },
        { model: MatchBroadcastLink, attributes: ['url', 'position'] },
      ],
    });
    if (!m) return res.status(404).json({ error: 'match_not_found' });

    let context = null;
    let restrictions = null;
    try {
      context = await resolveMatchAccessContext({
        matchOrId: m,
        userId: req.user.id,
      });
      restrictions = evaluateStaffMatchRestrictions(context);
    } catch (err) {
      if (err?.code === 'user_not_found') {
        context = null;
        restrictions = null;
      } else {
        context = null;
        restrictions = null;
      }
    }
    const isHome = context?.isHome || false;
    const isAway = context?.isAway || false;
    const permissions = buildPermissionPayload(restrictions || {}, context);
    return res.json({
      match: {
        id: m.id,
        date_start: m.date_start,
        scheduled_date: m.scheduled_date || null,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        score_team1: m.score_team1 ?? null,
        score_team2: m.score_team2 ?? null,
        technical_winner: m.technical_winner || null,
        ground: m.Ground?.name || null,
        ground_details: m.Ground
          ? {
              id: m.Ground.id,
              name: m.Ground.name,
              address: m.Ground.Address?.result || null,
              yandex_url: m.Ground.yandex_url || null,
              address_metro: m.Ground.Address?.metro || null,
              geo: {
                lat: m.Ground.Address?.geo_lat || null,
                lon: m.Ground.Address?.geo_lon || null,
              },
            }
          : null,
        team1: m.HomeTeam?.name || null,
        team2: m.AwayTeam?.name || null,
        home_club: m.HomeTeam?.Club?.name || null,
        home_club_id: m.HomeTeam?.Club?.id || null,
        home_club_is_moscow:
          typeof m.HomeTeam?.Club?.is_moscow === 'boolean'
            ? m.HomeTeam.Club.is_moscow
            : null,
        away_club: m.AwayTeam?.Club?.name || null,
        away_club_id: m.AwayTeam?.Club?.id || null,
        away_club_is_moscow:
          typeof m.AwayTeam?.Club?.is_moscow === 'boolean'
            ? m.AwayTeam.Club.is_moscow
            : null,
        tournament: m.Tournament?.name || null,
        double_protocol: !!m.Tournament?.TournamentType?.double_protocol,
        stage: m.Stage?.name || null,
        group: m.TournamentGroup?.name || null,
        tour: m.Tour?.name || null,
        season: m.Season?.name || null,
        season_active: m.Season?.active ?? null,
        is_home: isHome,
        is_away: isAway,
        schedule_locked_by_admin: !!m.schedule_locked_by_admin,
        status: m.GameStatus
          ? { name: m.GameStatus.name, alias: m.GameStatus.alias }
          : null,
        broadcast_links: (m.MatchBroadcastLinks || [])
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((x) => x.url)
          .filter(Boolean),
        permissions,
      },
    });
  } catch (e) {
    next(e);
  }
}
