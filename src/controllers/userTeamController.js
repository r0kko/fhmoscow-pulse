import teamService from '../services/teamService.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async listByUser(req, res) {
    try {
      const teams = await teamService.listUserTeams(req.params.id);
      return res.json({ teams: teams.map(teamMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async addForUser(req, res) {
    try {
      await teamService.addUserTeam(
        req.params.id,
        req.body.team_id,
        req.user.id
      );
      const teams = await teamService.listUserTeams(req.params.id);
      return res.json({ teams: teams.map(teamMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async removeForUser(req, res) {
    try {
      await teamService.removeUserTeam(
        req.params.id,
        req.params.teamId,
        req.user.id
      );
      const teams = await teamService.listUserTeams(req.params.id);
      return res.json({ teams: teams.map(teamMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
