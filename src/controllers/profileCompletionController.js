import userService from '../services/userService.js';
import { sendError } from '../utils/api.js';

const REGISTRATION_STEP_PATTERN = /^REGISTRATION_STEP_[1-5]$/;

export default {
  async complete(req, res) {
    try {
      const status = await req.user.getUserStatus();
      if (!REGISTRATION_STEP_PATTERN.test(String(status?.alias || ''))) {
        return res.status(403).json({ error: 'invalid_profile_transition' });
      }
      const user = await userService.setStatus(
        req.user.id,
        'ACTIVE',
        req.user.id
      );
      return res.json({
        user: { id: user.id, status: 'ACTIVE' },
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
    if (!REGISTRATION_STEP_PATTERN.test(String(status))) {
      return res.status(400).json({ error: 'invalid_profile_status' });
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
