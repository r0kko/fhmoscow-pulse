import { validationResult } from 'express-validator';

import clubUserService from '../services/clubUserService.js';
import clubMapper from '../mappers/clubMapper.js';
import userService from '../services/userService.js';
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

export default {
  async listByUser(req, res) {
    try {
      const clubs = await clubUserService.listUserClubs(req.params.id);
      return res.json({ clubs: clubs.map(clubMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async addForUser(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      await assertSportSchoolStaff(req.params.id);
      await clubUserService.addUserClub(
        req.params.id,
        req.body.club_id,
        req.user.id
      );
      const clubs = await clubUserService.listUserClubs(req.params.id);
      return res.json({ clubs: clubs.map(clubMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async removeForUser(req, res) {
    try {
      await assertSportSchoolStaff(req.params.id);
      await clubUserService.removeUserClub(
        req.params.id,
        req.params.clubId,
        req.user.id
      );
      const clubs = await clubUserService.listUserClubs(req.params.id);
      return res.json({ clubs: clubs.map(clubMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
