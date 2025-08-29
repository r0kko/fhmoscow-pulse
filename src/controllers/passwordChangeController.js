import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

import User from '../models/user.js';
import userService from '../services/userService.js';
import authService from '../services/authService.js';
import userMapper from '../mappers/userMapper.js';
import { setRefreshCookie } from '../utils/cookie.js';
import { sendError } from '../utils/api.js';

export default {
  async changeSelf(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { current_password: currentPassword, new_password: newPassword } =
      req.body;
    try {
      const user = await User.scope('withPassword').findByPk(req.user.id);
      if (!user) return res.status(404).json({ error: 'user_not_found' });
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok)
        return res.status(400).json({ error: 'invalid_current_password' });

      await userService.resetPassword(user.id, newPassword, user.id);
      await user.update({ password_change_required: false });
      await userService.bumpTokenVersion(user.id);

      const updated = await user.reload();
      const { accessToken, refreshToken } = authService.issueTokens(updated);
      setRefreshCookie(res, refreshToken);
      const roles = (await updated.getRoles({ attributes: ['alias'] })).map(
        (r) => r.alias
      );
      return res.json({
        access_token: accessToken,
        user: userMapper.toPublic(updated),
        roles,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
