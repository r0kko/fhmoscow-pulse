import userService from '../services/userService.js';
import { sendError } from '../utils/api.js';

export default {
  async complete(req, res) {
    try {
      const user = await userService.setStatus(
        req.user.id,
        'AWAITING_CONFIRMATION',
        req.user.id
      );
      return res.json({
        user: { id: user.id, status: 'AWAITING_CONFIRMATION' },
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async setStep(req, res) {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status_required' });
    }
    try {
      const user = await userService.setStatus(
        req.user.id,
        status,
        req.user.id
      );
      return res.json({ user: { id: user.id, status } });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
