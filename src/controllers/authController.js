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

    const { email, password } = req.body;

    try {
      const user = await authService.verifyCredentials(email, password);
      const { accessToken, refreshToken } = authService.issueTokens(user);

      setRefreshCookie(res, refreshToken);

      return res.json({
        access_token: accessToken,
        user: userMapper.toPublic(user),
      });
    } catch (_err) {
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
    return res.json({ user: userMapper.toPublic(req.user) });
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

      setRefreshCookie(res, refreshToken);

      return res.json({
        access_token: accessToken,
        user: userMapper.toPublic(user),
      });
    } catch (_err) {
      void _err;
      return res
        .status(401)
        .json({ error: 'Invalid or expired refresh token' });
    }
  },
};
