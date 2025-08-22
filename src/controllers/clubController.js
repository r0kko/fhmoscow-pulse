import clubService from '../services/clubService.js';
import clubMapper from '../mappers/clubMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    try {
      const clubs = await clubService.listAll();
      return res.json({ clubs: clubs.map(clubMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async sync(req, res) {
    try {
      await clubService.syncExternal(req.user?.id);
      const clubs = await clubService.listAll();
      return res.json({ clubs: clubs.map(clubMapper.toPublic) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
