import { validationResult } from 'express-validator';

import authService from '../services/authService.js';
import userMapper from '../mappers/userMapper.js';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookie.js';
import { COOKIE_NAME } from '../config/auth.js';

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
      const { accessToken, refreshToken } = authService.issueTokens(user);
      const roles = (await user.getRoles({ attributes: ['alias'] })).map(
        (r) => r.alias
      );

      setRefreshCookie(res, refreshToken);

      return res.json({
        access_token: accessToken,
        user: userMapper.toPublic(user),
        roles,
      });
    } catch (_err) {
      if (_err.message === 'account_locked') {
        return res
          .status(401)
          .json({
            error: 'Account locked due to multiple failed login attempts',
          });
      }
      void _err;
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  },

  /* POST /auth/logout */
  async logout(_req, res) {
    clearRefreshCookie(res);
    return res.status(200).json({ message: 'Logged out' });
  },

  /* GET /auth/me */
  async me(req, res) {
    const roles = (await req.user.getRoles({ attributes: ['alias'] })).map(
      (r) => r.alias
    );
    return res.json({ user: userMapper.toPublic(req.user), roles });
  },

  /* POST /auth/refresh */
  async refresh(req, res) {
    const token =
      req.cookies?.[COOKIE_NAME] ??
      req.body?.[COOKIE_NAME] ??
      req.body?.['refresh_token'];
    if (!token) {
      return res.status(401).json({ error: 'Refresh token missing' });
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
    } catch (_err) {
      void _err;
      return res
        .status(401)
        .json({ error: 'Invalid or expired refresh token' });
    }
  },
};
