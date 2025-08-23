import playerService from '../services/playerService.js';
import teamService from '../services/teamService.js';
import clubService from '../services/clubService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import playerMapper from '../mappers/playerMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        q,
        status,
        include,
        withTeams,
        withClubs,
      } = req.query;

      const includeTeams =
        withTeams === 'true' ||
        include === 'teams' ||
        (Array.isArray(include) && include.includes('teams'));
      const includeClubs =
        withClubs === 'true' ||
        include === 'clubs' ||
        (Array.isArray(include) && include.includes('clubs'));

      const { rows, count } = await playerService.list({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        status,
        includeTeams,
        includeClubs,
      });
      return res.json({
        players: rows.map(playerMapper.toPublic),
        total: count,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
      // keep related entities in sync first
      const clubStats = await clubService.syncExternal(req.user?.id);
      const teamStats = await teamService.syncExternal(req.user?.id);
      const stats = await playerService.syncExternal(req.user?.id);
      const { rows, count } = await playerService.list({ page: 1, limit: 100 });
      return res.json({
        stats: { clubs: clubStats, teams: teamStats, ...stats },
        players: rows.map(playerMapper.toPublic),
        total: count,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
