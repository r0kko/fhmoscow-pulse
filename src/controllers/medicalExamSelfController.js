import medicalExamRegistrationService from '../services/medicalExamRegistrationService.js';
import { sendError } from '../utils/api.js';

export default {
  async register(req, res) {
    try {
      await medicalExamRegistrationService.register(
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
      await medicalExamRegistrationService.unregister(req.user.id, req.params.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
