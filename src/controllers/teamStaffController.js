import { validationResult } from 'express-validator';

import userMapper from '../mappers/userMapper.js';
import userService from '../services/userService.js';
import teamService, { listTeamUsers } from '../services/teamService.js';
import { sendError } from '../utils/api.js';

async function assertSportSchoolStaff(userId) {
  const user = await userService.getUser(userId);
  const hasRole = (user.Roles || []).some(
    (r) => r.alias === 'SPORT_SCHOOL_STAFF'
  );
  if (!hasRole) {
    const err = new Error('user_must_be_sport_school_staff');
    err.status = 400;
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
      if (!isAdmin) {
        const allowedTeamIds = new Set(scope.allowedTeamIds || []);
        if (!allowedTeamIds.has(req.params.id)) {
          return res.status(403).json({ error: 'forbidden' });
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
      await assertSportSchoolStaff(userId);
      await teamService.addUserTeam(userId, req.params.id, req.user.id);
      const users = await listTeamUsers(req.params.id);
      return res.json({ users: userMapper.toPublicArray(users) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async remove(req, res) {
    try {
      await assertSportSchoolStaff(req.params.userId);
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
