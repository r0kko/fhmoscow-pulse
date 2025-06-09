import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import User from '../models/user.js';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';
const SECURE_COOKIE = process.env.NODE_ENV === 'production';

/* ---------- helpers ------------------------------------------------------- */
function generateAccessToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

function generateRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, process.env.JWT_SECRET, {
    expiresIn: REFRESH_TTL,
  });
}

/* ---------- controller ---------------------------------------------------- */
export default {
  /* POST /auth/login */
  async login(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = await User.scope('withPassword').findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: SECURE_COOKIE,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    const { password: _ignored, ...safeUser } = user.get({ plain: true });

    return res.json({ access_token: accessToken, user: safeUser });
  },

  /* POST /auth/logout */
  async logout(_req, res) {
    res.clearCookie('refresh_token');
    return res.status(200).json({ message: 'Logged out' });
  },

  /* GET /auth/me */
  async me(req, res) {
    return res.json({ user: req.user });
  },

  /* POST /auth/refresh */
  async refresh(req, res) {
    const token = req.cookies?.refresh_token || req.body.refresh_token;
    if (!token) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const user = await User.findByPk(payload.sub);
      if (!user) {
        throw new Error('User not found');
      }

      const accessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: SECURE_COOKIE,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.json({ access_token: accessToken });
    } catch (err) {
      return res
        .status(401)
        .json({ error: 'Invalid or expired refresh token' });
    }
  },
};
