import { validationResult } from 'express-validator';

import emailVerificationService from '../services/emailVerificationService.js';
import userMapper from '../mappers/userMapper.js';

export default {
  async send(req, res) {
    if (req.user.email_confirmed) {
      return res.status(400).json({ error: 'already_confirmed' });
    }
    await emailVerificationService.sendCode(req.user);
    return res.json({ message: 'sent' });
  },

  async confirm(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { code } = req.body;
    try {
      await emailVerificationService.verifyCode(req.user, code);
      const user = await req.user.reload();
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
