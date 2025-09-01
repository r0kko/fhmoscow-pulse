import { sendError } from '../utils/api.js';
import svc from '../services/tournamentAdminService.js';
import map from '../mappers/tournamentMapper.js';

export default {
  async listTypes(_req, res) {
    try {
      const types = await svc.listTypes();
      return res.json({ types: types.map(map.toPublicType) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async listTournaments(req, res) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        q,
        season_id,
        type_id,
        birth_year,
        status,
      } = req.query;
      const { rows, count } = await svc.listTournaments({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        season_id,
        type_id,
        birth_year,
        status,
      });
      return res.json({
        tournaments: rows.map(map.toPublicTournament),
        total: count,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listStages(req, res) {
    try {
      const { page = '1', limit = '20', tournament_id, status } = req.query;
      const { rows, count } = await svc.listStages({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        tournament_id,
        status,
      });
      return res.json({ stages: rows.map(map.toPublicStage), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listGroups(req, res) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        q,
        tournament_id,
        stage_id,
        status,
      } = req.query;
      const { rows, count } = await svc.listGroups({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        tournament_id,
        stage_id,
        status,
      });
      return res.json({ groups: rows.map(map.toPublicGroup), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listTournamentTeams(req, res) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        q,
        tournament_id,
        group_id,
        team_id,
        status,
      } = req.query;
      const { rows, count } = await svc.listTournamentTeams({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search: search || q || undefined,
        tournament_id,
        group_id,
        team_id,
        status,
      });
      return res.json({
        teams: rows.map(map.toPublicTournamentTeam),
        total: count,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
