import { validationResult } from 'express-validator';

import groundLinkService from '../services/groundLinkService.js';
import clubMapper from '../mappers/clubMapper.js';
import teamMapper from '../mappers/teamMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async listClubs(req, res) {
    try {
      const clubs = await groundLinkService.listGroundClubs(req.params.id);
      return res.json({ clubs: clubs.map(clubMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async addClub(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      await groundLinkService.addGroundClub(
        req.params.id,
        req.body.club_id,
        req.user.id
      );
      const clubs = await groundLinkService.listGroundClubs(req.params.id);
      return res.json({ clubs: clubs.map(clubMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async removeClub(req, res) {
    try {
      await groundLinkService.removeGroundClub(
        req.params.id,
        req.params.clubId,
        req.user.id
      );
      const clubs = await groundLinkService.listGroundClubs(req.params.id);
      return res.json({ clubs: clubs.map(clubMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listTeams(req, res) {
    try {
      const teams = await groundLinkService.listGroundTeams(req.params.id);
      return res.json({ teams: teams.map(teamMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async addTeam(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      await groundLinkService.addGroundTeam(
        req.params.id,
        req.body.team_id,
        req.user.id
      );
      const teams = await groundLinkService.listGroundTeams(req.params.id);
      return res.json({ teams: teams.map(teamMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async removeTeam(req, res) {
    try {
      await groundLinkService.removeGroundTeam(
        req.params.id,
        req.params.teamId,
        req.user.id
      );
      const teams = await groundLinkService.listGroundTeams(req.params.id);
      return res.json({ teams: teams.map(teamMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
