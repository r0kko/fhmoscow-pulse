import { validationResult } from 'express-validator';

import authService from '../services/authService.js';
import userMapper from '../mappers/userMapper.js';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookie.js';
import { COOKIE_NAME } from '../config/auth.js';
import { UserStatus } from '../models/index.js';
import { sendError } from '../utils/api.js';

/* ---------- controller ---------------------------------------------------- */
export default {
  /* POST /auth/login */
  async login(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phone, password } = req.body;

    try {
      const user = await authService.verifyCredentials(phone, password);
      const updated = await user.reload({ include: [UserStatus] });
      const { accessToken, refreshToken } = authService.issueTokens(updated);
      const roles = (await updated.getRoles({ attributes: ['alias'] })).map(
        (r) => r.alias
      );

      setRefreshCookie(res, refreshToken);

      const extra = {};
      const alias = updated.UserStatus?.alias;
      if (alias?.startsWith('REGISTRATION_STEP_')) {
        extra.next_step = parseInt(alias.split('_').pop(), 10);
      } else if (alias === 'AWAITING_CONFIRMATION') {
        extra.awaiting_confirmation = true;
      }

      return res.json({
        access_token: accessToken,
        user: userMapper.toPublic(updated),
        roles,
        ...extra,
      });
    } catch (err) {
      return sendError(res, err, 401);
    }
  },

  /* POST /auth/logout */
  async logout(req, res) {
    if (req.session) {
      req.session.destroy(() => {});
    }
    clearRefreshCookie(res);
    return res.status(200).json({ message: 'Logged out' });
  },

  /* GET /auth/me */
  async me(req, res) {
    const user = await req.user.reload({ include: [UserStatus] });
    const roles = (await user.getRoles({ attributes: ['alias'] })).map(
      (r) => r.alias
    );
    return res.json({ user: userMapper.toPublic(user), roles });
  },

  /* POST /auth/refresh */
  async refresh(req, res) {
    const token =
      req.cookies?.[COOKIE_NAME] ??
      req.body?.[COOKIE_NAME] ??
      req.body?.['refresh_token'];
    if (!token) {
      return res.status(401).json({ error: 'Отсутствует токен обновления' });
    }

    try {
      const { user, accessToken, refreshToken } =
        await authService.rotateTokens(token);
      const roles = (await user.getRoles({ attributes: ['alias'] })).map(
        (r) => r.alias
      );

      setRefreshCookie(res, refreshToken);

      return res.json({
        access_token: accessToken,
        user: userMapper.toPublic(user),
        roles,
      });
    } catch (err) {
      return sendError(res, err, 401);
    }
  },
};
