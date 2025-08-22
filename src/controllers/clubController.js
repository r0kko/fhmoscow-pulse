import clubService from '../services/clubService.js';
import clubMapper from '../mappers/clubMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        q,
        include,
        withTeams,
      } = req.query;
      const includeTeams =
        withTeams === 'true' ||
        include === 'teams' ||
        (Array.isArray(include) && include.includes('teams'));
      const { rows, count } = await clubService.list({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        includeTeams,
      });
      return res.json({ clubs: rows.map(clubMapper.toPublic), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async sync(req, res) {
    try {
      const stats = await clubService.syncExternal(req.user?.id);
      const { rows, count } = await clubService.list({ page: 1, limit: 100 });
      return res.json({
        stats,
        clubs: rows.map(clubMapper.toPublic),
        total: count,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
