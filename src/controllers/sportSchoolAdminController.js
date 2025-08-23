import clubUserService from '../services/clubUserService.js';
import teamService from '../services/teamService.js';
import userService from '../services/userService.js';
import clubMapper from '../mappers/clubMapper.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async getLinks(req, res) {
    try {
      const user = await userService.getUser(req.params.id);
      const [clubs, teams] = await Promise.all([
        clubUserService.listUserClubs(user.id),
        teamService.listUserTeams(user.id),
      ]);
      return res.json({
        user: {
          id: user.id,
          fio: `${user.last_name} ${user.first_name} ${user.patronymic || ''}`.trim(),
        },
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
