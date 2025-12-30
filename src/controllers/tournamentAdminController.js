import { sendError } from '../utils/api.js';
import svc from '../services/tournamentAdminService.js';
import map from '../mappers/tournamentMapper.js';
import {
  MATCH_FORMAT_OPTIONS,
  REFEREE_PAYMENT_OPTIONS,
} from '../utils/tournamentSettings.js';

export default {
  async listTypes(_req, res) {
    try {
      const types = await svc.listTypes();
      return res.json({ types: types.map(map.toPublicType) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async listSettingsOptions(_req, res) {
    try {
      const competitionTypes = await svc.listCompetitionTypes();
      return res.json({
        competition_types: competitionTypes.map(map.toPublicCompetitionType),
        match_formats: MATCH_FORMAT_OPTIONS,
        referee_payment_types: REFEREE_PAYMENT_OPTIONS,
      });
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
  async createTournament(req, res) {
    try {
      const tournament = await svc.createTournament(req.body, req.user?.id);
      return res
        .status(201)
        .json({ tournament: map.toPublicTournament(tournament) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async updateTournament(req, res) {
    try {
      const tournament = await svc.updateTournament(
        req.params.id,
        req.body,
        req.user?.id
      );
      return res.json({ tournament: map.toPublicTournament(tournament) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
  async createStage(req, res) {
    try {
      const stage = await svc.createStage(req.body, req.user?.id);
      return res.status(201).json({ stage: map.toPublicStage(stage) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async createGroup(req, res) {
    try {
      const group = await svc.createGroup(req.body, req.user?.id);
      return res.status(201).json({ group: map.toPublicGroup(group) });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async updateGroup(req, res) {
    try {
      const group = await svc.updateGroup(
        req.params.id,
        req.body,
        req.user?.id
      );
      return res.json({ group: map.toPublicGroup(group) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
  async listRefereeRoles(_req, res) {
    try {
      const groups = await svc.listRefereeRoleGroups();
      return res.json({
        groups: groups.map(map.toPublicRefereeRoleGroup),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async listGroupReferees(req, res) {
    try {
      const { tournament_id } = req.query;
      const assignments = await svc.listGroupReferees({ tournament_id });
      return res.json({ assignments });
    } catch (err) {
      return sendError(res, err);
    }
  },
  async updateGroupReferees(req, res) {
    try {
      const roles = req.body?.roles || [];
      const assignments = await svc.updateGroupReferees(
        req.params.id,
        roles,
        req.user?.id
      );
      return res.json({ assignments });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
