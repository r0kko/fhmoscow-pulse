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
    // Anti-enumeration: same response whether account exists or not.
    if (!user) {
      return res.json({ message: 'if_account_exists_code_sent' });
    }
    try {
      await passwordResetService.sendCode(user);
      return res.json({ message: 'if_account_exists_code_sent' });
    } catch (err) {
      // Keep response neutral for start flow to avoid account discovery.
      if (err?.code === 'too_many_attempts') {
        return res.json({ message: 'if_account_exists_code_sent' });
      }
      return res.json({ message: 'if_account_exists_code_sent' });
    }
  },

  async finish(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Normalize password validation error to a single code for client UX
      const items = errors.array();
      const weakPwd = items.find(
        (e) =>
          (e.path === 'password' || e.param === 'password') &&
          (e.msg === 'weak_password' ||
            String(e.msg).toLowerCase() === 'weak_password')
      );
      if (weakPwd) {
        return res.status(400).json({ error: 'weak_password' });
      }
      return res.status(400).json({ errors: items });
    }
    const { email, code, password } = req.body;
    const user = await User.findOne({ where: { email } });
    // Anti-enumeration: do not reveal whether email exists.
    if (!user) return res.status(400).json({ error: 'invalid_code' });
    try {
      await passwordResetService.verifyCode(user, code);
      await userService.resetPassword(user.id, password, user.id);
      // Bump token version to invalidate any existing refresh tokens
      await userService.bumpTokenVersion(user.id);
      return res.json({ message: 'password_updated' });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
