import { validationResult } from 'express-validator';

import teamService from '../services/teamService.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const teams = await teamService.listUserTeams(req.user.id);
      return res.json({ teams: teams.map(teamMapper.toPublic) });
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
      await teamService.addUserTeam(req.user.id, req.body.team_id, req.user.id);
      const teams = await teamService.listUserTeams(req.user.id);
      return res.json({ teams: teams.map(teamMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async remove(req, res) {
    try {
      await teamService.removeUserTeam(
        req.user.id,
        req.params.teamId,
        req.user.id
      );
      const teams = await teamService.listUserTeams(req.user.id);
      return res.json({ teams: teams.map(teamMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
