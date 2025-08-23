import teamService from '../services/teamService.js';
import clubService from '../services/clubService.js';
import { isExternalDbAvailable } from '../config/externalMariaDb.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        q,
        club_id,
        birth_year,
        status,
      } = req.query;
      const { rows, count } = await teamService.list({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        club_id,
        birth_year,
        status,
      });
      return res.json({ teams: rows.map(teamMapper.toPublic), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async sync(req, res) {
    try {
      if (!isExternalDbAvailable()) {
        return res.status(503).json({ error: 'external_unavailable' });
      }
      // Keep clubs in sync first to maintain relations and accurate soft-deletes
      const clubStats = await clubService.syncExternal(req.user?.id);
      const stats = await teamService.syncExternal(req.user?.id);
      const teams = await teamService.listAll();
      return res.json({
        stats: { clubs: clubStats, teams: stats },
        teams: teams.map(teamMapper.toPublic),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
