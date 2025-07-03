import trainingRegistrationService from '../services/trainingRegistrationService.js';
import mapper from '../mappers/trainingMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async available(req, res) {
    const { page = '1', limit = '20' } = req.query;
    try {
      const { rows, count } = await trainingRegistrationService.listAvailable(
        req.user.id,
        { page: parseInt(page, 10), limit: parseInt(limit, 10) }
      );
      return res.json({ trainings: rows.map(mapper.toPublic), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async upcoming(req, res) {
    const { page = '1', limit = '20' } = req.query;
    try {
      const { rows, count } = await trainingRegistrationService.listUpcomingByUser(
        req.user.id,
        { page: parseInt(page, 10), limit: parseInt(limit, 10) }
      );
      return res.json({ trainings: rows.map(mapper.toPublic), total: count });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async register(req, res) {
    try {
      await trainingRegistrationService.register(
        req.user.id,
        req.params.id,
        req.user.id
      );
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async unregister(req, res) {
    try {
      await trainingRegistrationService.unregister(req.user.id, req.params.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
