import refereeAssignmentService from '../services/refereeAssignmentService.js';
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
      const { date } = req.query;
      const data = await refereeAssignmentService.listMatchesByDate(date);
      return res.json(data);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async listReferees(req, res) {
    try {
      const { date, role_group_id, search, limit } = req.query;
      const data = await refereeAssignmentService.listRefereesByDate({
        dateKey: date,
        roleGroupId: role_group_id || null,
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
      return res.json(data);
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
};
