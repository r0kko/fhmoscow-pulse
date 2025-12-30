import { validationResult } from 'express-validator';

import userMapper from '../mappers/userMapper.js';
import teamService, { listTeamUsers } from '../services/teamService.js';
import { Team, UserClub } from '../models/index.js';
import { sendError } from '../utils/api.js';

async function ensureUserInClub(userId, clubId) {
  if (!userId || !clubId) return false;
  const link = await UserClub.findOne({
    where: { user_id: userId, club_id: clubId },
  });
  return Boolean(link);
}

export default {
  async list(req, res) {
    try {
      const users = await listTeamUsers(req.params.id);
      return res.json({ users: userMapper.toPublicArray(users) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async listForStaff(req, res) {
    try {
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      const managerClubIds = new Set(
        (scope.managerClubIds || []).map((id) => String(id))
      );
      if (!isAdmin) {
        const allowedTeamIds = new Set(scope.allowedTeamIds || []);
        if (!allowedTeamIds.has(req.params.id)) {
          const team = await Team.findByPk(req.params.id, {
            attributes: ['club_id'],
          });
          if (!team) {
            return res.status(404).json({ error: 'team_not_found' });
          }
          if (!managerClubIds.has(String(team.club_id))) {
            return res.status(403).json({ error: 'forbidden' });
          }
        }
      }
      const users = await listTeamUsers(req.params.id);
      return res.json({ users: userMapper.toPublicArray(users) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async add(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const userId = req.body.user_id;
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      if (!isAdmin) {
        const team = req.team
          ? req.team
          : await Team.findByPk(req.params.id, {
              attributes: ['club_id'],
            });
        const clubId = team?.club_id || null;
        const inClub = await ensureUserInClub(userId, clubId);
        if (!inClub) {
          return res
            .status(400)
            .json({ error: 'club_staff_link_required' });
        }
      }
      await teamService.addUserTeam(userId, req.params.id, req.user.id);
      const users = await listTeamUsers(req.params.id);
      return res.json({ users: userMapper.toPublicArray(users) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async remove(req, res) {
    try {
      const scope = req.access || {};
      const isAdmin = Boolean(scope.isAdmin);
      if (!isAdmin) {
        const team = req.team
          ? req.team
          : await Team.findByPk(req.params.id, {
              attributes: ['club_id'],
            });
        const clubId = team?.club_id || null;
        const inClub = await ensureUserInClub(req.params.userId, clubId);
        if (!inClub) {
          return res
            .status(400)
            .json({ error: 'club_staff_link_required' });
        }
      }
      await teamService.removeUserTeam(
        req.params.userId,
        req.params.id,
        req.user.id
      );
      const users = await listTeamUsers(req.params.id);
      return res.json({ users: userMapper.toPublicArray(users) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
