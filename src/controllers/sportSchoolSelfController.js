import clubUserService from '../services/clubUserService.js';
import teamService from '../services/teamService.js';
import clubMapper from '../mappers/clubMapper.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async getLinks(req, res) {
    try {
      const userId = req.user.id;
      const [clubs, teams] = await Promise.all([
        clubUserService.listUserClubs(userId),
        teamService.listUserTeams(userId),
      ]);
      return res.json({
        clubs: clubs.map(clubMapper.toPublic),
        teams: teams.map(teamMapper.toPublic),
        has_club: clubs.length > 0,
        has_team: teams.length > 0,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
