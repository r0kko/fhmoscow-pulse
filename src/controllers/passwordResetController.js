import { validationResult } from 'express-validator';

import { User } from '../models/index.js';
import passwordResetService from '../services/passwordResetService.js';
import userService from '../services/userService.js';
import { sendError } from '../utils/api.js';

export default {
  async start(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'not_found' });
    await passwordResetService.sendCode(user);
    return res.json({ message: 'code_sent' });
  },

  async finish(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, code, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'not_found' });
    try {
      await passwordResetService.verifyCode(user, code);
      await userService.resetPassword(user.id, password);
      return res.json({ message: 'password_updated' });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
