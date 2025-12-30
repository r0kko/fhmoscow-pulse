import clubUserService from '../services/clubUserService.js';
import teamService from '../services/teamService.js';
import clubMapper from '../mappers/clubMapper.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';
import { syncStaffRole } from '../services/sportSchoolRoleService.js';
import { UserClub, SportSchoolPosition } from '../models/index.js';

export default {
  async getLinks(req, res) {
    try {
      const userId = req.user.id;
      await syncStaffRole(userId, userId);
      const [clubs, teams] = await Promise.all([
        clubUserService.listUserClubs(userId),
        teamService.listUserTeams(userId),
      ]);
      let clubsPayload = clubs.map(clubMapper.toPublic);
      const needsPosition = clubsPayload.some(
        (club) =>
          club &&
          club.sport_school_position_alias == null &&
          club.sport_school_position_id == null
      );
      if (needsPosition && clubsPayload.length > 0) {
        const memberships = await UserClub.findAll({
          where: { user_id: userId },
          include: [
            {
              model: SportSchoolPosition,
              as: 'SportSchoolPosition',
              attributes: ['alias', 'name'],
              required: false,
            },
          ],
          attributes: ['club_id', 'sport_school_position_id'],
        });
        const positionByClub = new Map(
          memberships.map((row) => [
            row.club_id,
            {
              id: row.sport_school_position_id || null,
              alias: row.SportSchoolPosition?.alias || null,
              name: row.SportSchoolPosition?.name || null,
            },
          ])
        );
        clubsPayload = clubsPayload.map((club) => {
          if (!club) return club;
          if (
            club.sport_school_position_alias != null ||
            club.sport_school_position_id != null
          )
            return club;
          const position = positionByClub.get(club.id);
          if (!position) return club;
          return {
            ...club,
            sport_school_position_id: position.id,
            sport_school_position_alias: position.alias || undefined,
            sport_school_position_name: position.name || undefined,
          };
        });
      }
      return res.json({
        clubs: clubsPayload,
        teams: teams.map(teamMapper.toPublic),
        has_club: clubs.length > 0,
        has_team: teams.length > 0,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
