import { validationResult } from 'express-validator';

import authService from '../services/authService.js';
import {
  incAuthLogin,
  incAuthRefresh,
  incTokenIssued,
} from '../config/metrics.js';
import userService from '../services/userService.js';
import userMapper from '../mappers/userMapper.js';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookie.js';
import { COOKIE_NAME } from '../config/auth.js';
import { UserStatus } from '../models/index.js';
import { sendError } from '../utils/api.js';
import { isStaffOnly } from '../utils/roles.js';

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
      // Rotate session version on successful login to invalidate prior refresh tokens
      await user.increment('token_version');
      const updated = await user.reload({ include: [UserStatus] });
      const { accessToken, refreshToken } = authService.issueTokens(updated);
      incAuthLogin('success');
      incTokenIssued('access');
      incTokenIssued('refresh');
      const roles = (await updated.getRoles({ attributes: ['alias'] })).map(
        (r) => r.alias
      );
      const staffOnly = isStaffOnly(roles);

      // Prevent any intermediate cache (CDN/proxy) from caching auth responses
      // and ensure Set-Cookie is honored per request context
      if (typeof res?.set === 'function') {
        res.set(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, max-age=0'
        );
        res.set('Pragma', 'no-cache');
      }
      if (typeof res?.vary === 'function') res.vary('Cookie');
      setRefreshCookie(res, refreshToken);

      const extra = {};
      const alias = updated.UserStatus?.alias;
      if (alias?.startsWith('REGISTRATION_STEP_')) {
        extra.next_step = parseInt(alias.split('_').pop(), 10);
      } else if (alias === 'AWAITING_CONFIRMATION') {
        extra.awaiting_confirmation = true;
      } else if (updated.password_change_required) {
        extra.must_change_password = true;
      }

      return res.json({
        access_token: accessToken,
        user: userMapper.toPublic(updated),
        roles,
        capabilities: {
          is_staff_only: staffOnly,
        },
        ...extra,
      });
    } catch (err) {
      try {
        incAuthLogin('invalid');
      } catch (_e) {
        /* noop */
      }
      return sendError(res, err, 401);
    }
  },

  /* POST /auth/logout */
  async logout(req, res) {
    if (req.session) {
      req.session.destroy(() => {});
    }
    // Invalidate existing refresh tokens across devices
    if (req.user?.id) {
      try {
        await userService.bumpTokenVersion(req.user.id);
      } catch {
        // best-effort; still clear cookie
      }
    }
    // Prevent caches from storing logout responses and make cookie semantics explicit
    if (typeof res?.set === 'function') {
      res.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, max-age=0'
      );
      res.set('Pragma', 'no-cache');
    }
    if (typeof res?.vary === 'function') res.vary('Cookie');
    clearRefreshCookie(res);
    return res.status(200).json({ message: 'Logged out' });
  },

  /* GET /auth/me */
  async me(req, res) {
    const user = await req.user.reload({ include: [UserStatus] });
    const roles = (await user.getRoles({ attributes: ['alias'] })).map(
      (r) => r.alias
    );
    const staffOnly = isStaffOnly(roles);
    const extra = {};
    if (user.password_change_required) {
      extra.must_change_password = true;
    }
    return res.json({
      user: userMapper.toPublic(user),
      roles,
      capabilities: {
        is_staff_only: staffOnly,
      },
      ...extra,
    });
  },

  /* POST /auth/refresh */
  async refresh(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only accept refresh token from secure HTTP-only cookie
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Отсутствует токен обновления' });
    }

    try {
      const { user, accessToken, refreshToken } =
        await authService.rotateTokens(token);
      incAuthRefresh('success');
      incTokenIssued('access');
      incTokenIssued('refresh');
      const roles = (await user.getRoles({ attributes: ['alias'] })).map(
        (r) => r.alias
      );
      const staffOnly = isStaffOnly(roles);

      // Avoid cache and ensure Set-Cookie is not stripped by intermediaries
      if (typeof res?.set === 'function') {
        res.set(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, max-age=0'
        );
        res.set('Pragma', 'no-cache');
      }
      if (typeof res?.vary === 'function') res.vary('Cookie');
      setRefreshCookie(res, refreshToken);

      return res.json({
        access_token: accessToken,
        user: userMapper.toPublic(user),
        roles,
        capabilities: {
          is_staff_only: staffOnly,
        },
      });
    } catch (err) {
      try {
        incAuthRefresh('invalid');
      } catch (_e) {
        /* noop */
      }
      return sendError(res, err, 401);
    }
  },

  /* GET /auth/cookie-cleanup */
  async cookieCleanup(req, res) {
    // Best-effort cleanup of legacy/broken cookies
    try {
      // Refresh token variants
      try {
        clearRefreshCookie(res);
      } catch (_) {
        /* */
      }
      // CSRF cookies (both names, multiple paths/domains)
      const names = ['XSRF-TOKEN-API', 'XSRF-TOKEN'];
      const domain = process.env.COOKIE_DOMAIN || undefined;
      let hostDomain;
      try {
        const xf = req?.headers?.['x-forwarded-host'];
        const raw =
          (Array.isArray(xf) ? xf[0] : xf) || req?.headers?.host || '';
        hostDomain = String(raw).split(',')[0].trim().replace(/:\d+$/, '');
      } catch (_) {
        hostDomain = undefined;
      }
      const variants = [
        { path: '/', domain },
        { path: '/', domain: undefined },
        { path: '/api', domain },
        { path: '/api', domain: undefined },
        ...(hostDomain
          ? [
              { path: '/', domain: hostDomain },
              { path: '/api', domain: hostDomain },
            ]
          : []),
      ];
      for (const name of names) {
        for (const v of variants) {
          res.clearCookie(name, { ...v, secure: true, sameSite: 'none' });
        }
      }
    } catch (_) {
      // ignore
    }
    // Avoid cache as we are sending Set-Cookie
    if (typeof res?.set === 'function') {
      res.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, max-age=0'
      );
      res.set('Pragma', 'no-cache');
    }
    if (typeof res?.vary === 'function') res.vary('Cookie');
    return res.json({ ok: true });
  },
};
