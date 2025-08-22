import teamService from '../services/teamService.js';
import clubService from '../services/clubService.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const teams = await teamService.listAll();
      return res.json({ teams: teams.map(teamMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async sync(req, res) {
    try {
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
