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
};
