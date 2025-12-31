import { validationResult } from 'express-validator';

import userService from '../services/userService.js';
import userMapper from '../mappers/userMapper.js';
import { UserClub, SportSchoolPosition } from '../models/index.js';
import {
  addClubUser,
  removeClubUser,
  updateClubUserPosition,
} from '../services/clubUserService.js';
import sportSchoolStructureService from '../services/sportSchoolStructureService.js';
import sportSchoolPositionService from '../services/sportSchoolPositionService.js';
import { sendError } from '../utils/api.js';
import { isSportSchoolEditablePosition } from '../utils/sportSchoolPositions.js';
import ServiceError from '../errors/ServiceError.js';

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

function resolveAccess(req) {
  const scope = req.access || {};
  return { isAdmin: Boolean(scope.isAdmin) };
}

async function resolvePosition(raw) {
  if (typeof raw === 'undefined') return undefined;
  if (raw === null || raw === '') return null;
  const position = await sportSchoolPositionService.getById(raw);
  if (!position) {
    const err = new Error('sport_school_position_not_found');
    err.status = 400;
    throw err;
  }
  return position;
}

async function resolveMembership(clubId, userId) {
  const membership = await UserClub.findOne({
    where: { club_id: clubId, user_id: userId },
    include: [
      {
        model: SportSchoolPosition,
        as: 'SportSchoolPosition',
        attributes: ['alias', 'name'],
        required: false,
      },
    ],
  });
  if (!membership) {
    throw new ServiceError('club_staff_link_not_found', 404);
  }
  return membership;
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
      const { isAdmin } = resolveAccess(req);
      const userId = req.body.user_id;
      const position = await resolvePosition(req.body.position_id);
      if (!isAdmin) {
        if (!position?.id) {
          const err = new Error('position_id_required');
          err.status = 400;
          throw err;
        }
        ensureEditablePosition(position.alias);
      }
      await addClubUser(req.params.id, userId, req.user.id, {
        positionId: position?.id || null,
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
      const { isAdmin } = resolveAccess(req);
      const position = await resolvePosition(req.body.position_id);
      if (!isAdmin) {
        const membership = await resolveMembership(
          req.params.id,
          req.params.userId
        );
        const currentAlias = membership.SportSchoolPosition?.alias || null;
        if (currentAlias) ensureEditablePosition(currentAlias);
        if (!position?.id) {
          const err = new Error('position_id_required');
          err.status = 400;
          throw err;
        }
        ensureEditablePosition(position.alias);
      }
      await updateClubUserPosition(
        req.params.id,
        req.params.userId,
        position?.id || null,
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
      const { isAdmin } = resolveAccess(req);
      if (!isAdmin) {
        const membership = await resolveMembership(
          req.params.id,
          req.params.userId
        );
        const currentAlias = membership.SportSchoolPosition?.alias || null;
        ensureEditablePosition(currentAlias);
      }
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
