import clubUserService from '../services/clubUserService.js';
import clubMapper from '../mappers/clubMapper.js';
import { sendError } from '../utils/api.js';

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
    try {
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
