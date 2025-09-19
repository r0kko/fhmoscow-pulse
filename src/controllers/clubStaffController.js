import { validationResult } from 'express-validator';

import userService from '../services/userService.js';
import {
  addClubUser,
  removeClubUser,
  updateClubUserPosition,
} from '../services/clubUserService.js';
import sportSchoolStructureService from '../services/sportSchoolStructureService.js';
import sportSchoolPositionService from '../services/sportSchoolPositionService.js';
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
      await assertSportSchoolStaff(userId);
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
      await assertSportSchoolStaff(req.params.userId);
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
      await assertSportSchoolStaff(req.params.userId);
      await removeClubUser(req.params.id, req.params.userId, req.user.id);
      const structure = await sportSchoolStructureService.getClubStructure(
        req.params.id
      );
      return res.json(buildUsersResponse(structure));
    } catch (err) {
      return sendError(res, err);
    }
  },
};
