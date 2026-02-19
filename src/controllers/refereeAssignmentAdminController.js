import refereeAssignmentService from '../services/refereeAssignmentService.js';
import documentService from '../services/documentService.js';
import map from '../mappers/tournamentMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async listRoleGroups(_req, res) {
    try {
      const groups = await refereeAssignmentService.listRoleGroups();
      return res.json({
        groups: groups.map(map.toPublicRefereeRoleGroup),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listMatches(req, res) {
    try {
      const { date, from, to, competition_alias } = req.query;
      const data = await refereeAssignmentService.listMatchesByDate(
        from || to || competition_alias
          ? {
              date,
              from,
              to,
              competitionAlias: competition_alias,
            }
          : date
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listReferees(req, res) {
    try {
      const {
        date,
        from,
        to,
        role_group_id,
        search,
        limit,
        role_alias,
        competition_alias,
        only_leagues_access,
      } = req.query;
      const onlyLeaguesAccess =
        only_leagues_access === '1' || only_leagues_access === 'true';
      const data = await refereeAssignmentService.listRefereesByDate({
        dateKey: date,
        from,
        to,
        roleAlias: role_alias,
        roleGroupId: role_group_id || null,
        competitionAlias: competition_alias || '',
        onlyLeaguesAccess,
        search: search || '',
        limit,
      });
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async updateMatchReferees(req, res) {
    try {
      const data = await refereeAssignmentService.updateMatchReferees(
        req.params.id,
        req.body.assignments || [],
        req.user.id,
        {
          roleGroupId: req.body.role_group_id || null,
          clearPublished: Boolean(req.body.clear_published),
        }
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async publishMatchReferees(req, res) {
    try {
      const data = await refereeAssignmentService.publishMatchReferees(
        req.params.id,
        req.user.id
      );
      const response = Array.isArray(data) ? { assignments: data } : data;
      return res.json(response);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async publishDay(req, res) {
    try {
      const groupIds = Array.isArray(req.body?.role_group_ids)
        ? req.body.role_group_ids
        : req.body?.role_group_id
          ? [req.body.role_group_id]
          : [];
      const data = await refereeAssignmentService.publishAssignmentsForDate(
        req.body?.date,
        req.user.id,
        { roleGroupIds: groupIds }
      );
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async createMatchAssignmentsSheet(req, res) {
    try {
      const data =
        await documentService.createProLeagueMatchRefereeAssignmentsDocument(
          req.params.id,
          req.user.id,
          {
            signerUserId: req.body?.signer_user_id || null,
          }
        );
      return res.status(201).json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async getMatchAssignmentsSheet(req, res) {
    try {
      const data =
        await documentService.getProLeagueMatchRefereeAssignmentsSheet(
          req.params.id
        );
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },
};
