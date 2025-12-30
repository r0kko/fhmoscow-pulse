import { validationResult } from 'express-validator';

import userService from '../services/userService.js';
import userMapper from '../mappers/userMapper.js';
import { UserClub } from '../models/index.js';
import {
  addClubUser,
  removeClubUser,
  updateClubUserPosition,
} from '../services/clubUserService.js';
import sportSchoolStructureService from '../services/sportSchoolStructureService.js';
import sportSchoolPositionService from '../services/sportSchoolPositionService.js';
import { sendError } from '../utils/api.js';

function mapStaffEntryToUserPayload(entry) {
  if (!entry) return null;
  const { user, position, teams } = entry;
  return {
    ...user,
    sport_school_position_id: position?.id || null,
    sport_school_position_alias: position?.alias || null,
    sport_school_position_name: position?.name || null,
    teams,
  };
}

function buildUsersResponse(structure) {
  return {
    club: structure.club,
    positions: structure.positions,
    users: structure.staff.map(mapStaffEntryToUserPayload),
    teams: structure.teams,
  };
}

async function normalizePositionId(raw) {
  if (typeof raw === 'undefined') return undefined;
  if (raw === null || raw === '') return null;
  const position = await sportSchoolPositionService.getById(raw);
  if (!position) {
    const err = new Error('sport_school_position_not_found');
    err.status = 400;
    throw err;
  }
  return position.id;
}

export default {
  async list(req, res) {
    try {
      // legacy fallback to keep backward compatibility when structure endpoint is unused
      const structure = await sportSchoolStructureService.getClubStructure(
        req.params.id
      );
      return res.json(buildUsersResponse(structure));
    } catch (err) {
      return sendError(res, err);
    }
  },

  async structure(req, res) {
    try {
      const structure = await sportSchoolStructureService.getClubStructure(
        req.params.id
      );
      return res.json(structure);
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
      const positionId = await normalizePositionId(req.body.position_id);
      await addClubUser(req.params.id, userId, req.user.id, {
        positionId,
      });
      const structure = await sportSchoolStructureService.getClubStructure(
        req.params.id
      );
      return res.json(buildUsersResponse(structure));
    } catch (err) {
      return sendError(res, err);
    }
  },

  async updatePosition(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const positionId = await normalizePositionId(req.body.position_id);
      await updateClubUserPosition(
        req.params.id,
        req.params.userId,
        positionId,
        req.user.id
      );
      const structure = await sportSchoolStructureService.getClubStructure(
        req.params.id
      );
      return res.json(buildUsersResponse(structure));
    } catch (err) {
      return sendError(res, err);
    }
  },

  async remove(req, res) {
    try {
      await removeClubUser(req.params.id, req.params.userId, req.user.id);
      const structure = await sportSchoolStructureService.getClubStructure(
        req.params.id
      );
      return res.json(buildUsersResponse(structure));
    } catch (err) {
      return sendError(res, err);
    }
  },

  async candidates(req, res) {
    try {
      const search = String(req.query.search || req.query.q || '').trim();
      const limit = Math.min(
        Math.max(parseInt(req.query.limit || '50', 10) || 50, 1),
        100
      );
      const { rows } = await userService.listUsers({
        search,
        limit,
      });
      const linked = await UserClub.findAll({
        where: { club_id: req.params.id },
        attributes: ['user_id'],
      });
      const linkedIds = new Set(linked.map((row) => row.user_id));
      const filtered = rows.filter((user) => !linkedIds.has(user.id));
      return res.json({ users: userMapper.toPublicArray(filtered) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
