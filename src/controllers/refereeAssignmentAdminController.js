import refereeAssignmentService from '../services/refereeAssignmentService.js';
import documentService from '../services/documentService.js';
import map from '../mappers/tournamentMapper.js';
import { sendError } from '../utils/api.js';

function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return defaultValue;
}

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
        require_preset_for_date,
      } = req.query;
      const onlyLeaguesAccess =
        only_leagues_access === '1' || only_leagues_access === 'true';
      const requirePresetForDate =
        require_preset_for_date === '1' || require_preset_for_date === 'true';
      const data = await refereeAssignmentService.listRefereesByDate({
        dateKey: date,
        from,
        to,
        roleAlias: role_alias,
        roleGroupId: role_group_id || null,
        competitionAlias: competition_alias || '',
        onlyLeaguesAccess,
        requirePresetForDate,
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
          clearPublished: parseBooleanFlag(req.body.clear_published, false),
          expectedDraftVersion: req.body.expected_draft_version || null,
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
        req.user.id,
        {
          allowIncomplete: parseBooleanFlag(req.body?.allow_incomplete, false),
        }
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
        {
          roleGroupIds: groupIds,
          allowIncomplete: parseBooleanFlag(req.body?.allow_incomplete, true),
        }
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
