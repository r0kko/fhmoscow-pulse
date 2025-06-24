import userService from '../services/userService.js';

export default {
  async complete(req, res) {
    try {
      const user = await userService.setStatus(
        req.user.id,
        'AWAITING_CONFIRMATION'
      );
      return res.json({
        user: { id: user.id, status: 'AWAITING_CONFIRMATION' },
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  async setStep(req, res) {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status_required' });
    }
    try {
      const user = await userService.setStatus(req.user.id, status);
      return res.json({ user: { id: user.id, status } });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
