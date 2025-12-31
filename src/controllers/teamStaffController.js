import { validationResult } from 'express-validator';

import userMapper from '../mappers/userMapper.js';
import teamService, { listTeamUsers } from '../services/teamService.js';
import { Team, UserClub, SportSchoolPosition } from '../models/index.js';
import { sendError } from '../utils/api.js';
import { isSportSchoolEditablePosition } from '../utils/sportSchoolPositions.js';

async function resolveUserClubMembership(userId, clubId) {
  if (!userId || !clubId) return false;
  return await UserClub.findOne({
    where: { user_id: userId, club_id: clubId },
    include: [
      {
        model: SportSchoolPosition,
        as: 'SportSchoolPosition',
        attributes: ['alias'],
        required: false,
      },
    ],
  });
}

function ensureEditablePosition(positionAlias) {
  if (!isSportSchoolEditablePosition(positionAlias)) {
    const err = new Error('staff_position_restricted');
    err.status = 403;
    throw err;
  }
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
        const membership = await resolveUserClubMembership(userId, clubId);
        if (!membership) {
          return res.status(400).json({ error: 'club_staff_link_required' });
        }
        const positionAlias = membership.SportSchoolPosition?.alias || null;
        ensureEditablePosition(positionAlias);
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
        const membership = await resolveUserClubMembership(
          req.params.userId,
          clubId
        );
        if (!membership) {
          return res.status(400).json({ error: 'club_staff_link_required' });
        }
        const positionAlias = membership.SportSchoolPosition?.alias || null;
        ensureEditablePosition(positionAlias);
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
