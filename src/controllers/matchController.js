import service, { listUpcomingLocal } from '../services/matchService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import {
  Match,
  Team,
  Ground,
  Tournament,
  TournamentGroup,
  Tour,
  User,
} from '../models/index.js';

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
    const m = await Match.findByPk(req.params.id, {
      attributes: ['id', 'date_start', 'ground_id', 'team1_id', 'team2_id'],
      include: [
        { model: Team, as: 'HomeTeam', attributes: ['name'] },
        { model: Team, as: 'AwayTeam', attributes: ['name'] },
        { model: Ground, attributes: ['name'] },
        { model: Tournament, attributes: ['name'] },
        { model: TournamentGroup, attributes: ['name'] },
        { model: Tour, attributes: ['name'] },
      ],
    });
    if (!m) return res.status(404).json({ error: 'match_not_found' });

    let isHome = false;
    let isAway = false;
    try {
      const user = await User.findByPk(req.user.id, { include: [Team] });
      const teamIds = new Set((user?.Teams || []).map((t) => t.id));
      isHome = teamIds.has(m.team1_id);
      isAway = teamIds.has(m.team2_id);
    } catch {
      /* ignore side computation errors */
    }
    return res.json({
      match: {
        id: m.id,
        date_start: m.date_start,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        ground: m.Ground?.name || null,
        team1: m.HomeTeam?.name || null,
        team2: m.AwayTeam?.name || null,
        tournament: m.Tournament?.name || null,
        group: m.TournamentGroup?.name || null,
        tour: m.Tour?.name || null,
        is_home: isHome,
        is_away: isAway,
      },
    });
  } catch (e) {
    next(e);
  }
}
