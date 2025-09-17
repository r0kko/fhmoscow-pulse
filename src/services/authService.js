import bcrypt from 'bcryptjs';

import User from '../models/user.js';
import { UserStatus } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import {
  decodeJwt,
  signAccessToken,
  signRefreshTokenWithJti,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { LOGIN_MAX_ATTEMPTS } from '../config/auth.js';
import { isLockoutEnabled } from '../config/featureFlags.js';
import { incRefreshReuse, incSecurityEvent } from '../config/metrics.js';

import {
  currentJti,
  isUsed,
  markUsed,
  rememberIssued,
} from './refreshStore.js';
import * as attempts from './loginAttempts.js';
import * as lockout from './accountLockout.js';

/* ------------------- service implementation ------------------------------ */
async function verifyCredentials(phone, password) {
  const user = await User.scope('withPassword').findOne({ where: { phone } });
  if (!user) throw new ServiceError('invalid_credentials', 401);

  const inactive = await UserStatus.findOne({ where: { alias: 'INACTIVE' } });
  if (inactive && user.status_id === inactive.id) {
    throw new ServiceError('account_locked', 401);
  }

  // Temporary lockout check (optional, disabled by default for UX)
  if (isLockoutEnabled()) {
    if (await lockout.isLocked(user.id)) {
      const ttlMs = await lockout.getTtlMs(user.id);
      const err = new ServiceError('account_locked', 401);
      if (ttlMs > 0) err.retryAfter = Math.ceil(ttlMs / 1000);
      throw err;
    }
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    if (isLockoutEnabled()) {
      const count = await attempts.markFailed(user.id);
      if (count >= LOGIN_MAX_ATTEMPTS) {
        // Enforce temporary lockout via Redis; do not change persistent status
        await lockout.lock(user.id);
        await attempts.clear(user.id);
        const err = new ServiceError('account_locked', 401);
        // best-effort TTL for Retry-After header
        const ttlMs = await lockout.getTtlMs(user.id);
        if (ttlMs > 0) err.retryAfter = Math.ceil(ttlMs / 1000);
        throw err;
      }
    }
    throw new ServiceError('invalid_credentials', 401);
  }

  if (isLockoutEnabled()) {
    await attempts.clear(user.id);
  }

  return user;
}

function issueTokens(user) {
  const accessToken = signAccessToken(user);
  // generate refresh with jti
  const refreshToken = signRefreshTokenWithJti(user, undefined); // function returns token string
  // best-effort: remember current jti for this version
  try {
    const payload = decodeJwt(refreshToken);
    if (payload?.jti && payload?.sub && payload?.ver != null) {
      void rememberIssued({
        sub: payload.sub,
        ver: payload.ver,
        jti: payload.jti,
        exp: payload.exp,
      });
    }
  } catch (_e) {
    /* noop */
  }
  return { accessToken, refreshToken };
}

async function rotateTokens(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);

  const user = await User.findByPk(payload.sub);
  if (!user) throw new ServiceError('user_not_found', 401);

  // Reject if token version was rotated already
  if (typeof payload.ver !== 'number' || payload.ver !== user.token_version) {
    // If this jti was already used earlier, treat as reuse attempt
    let reuseDetected = false;
    if (payload?.jti) {
      try {
        reuseDetected = await isUsed({
          sub: payload.sub,
          ver: payload.ver,
          jti: payload.jti,
        });
      } catch (_e) {
        reuseDetected = false;
      }
    }
    if (reuseDetected) {
      // Security response: bump version again to invalidate any issued since, optional lock
      try {
        await user.increment('token_version');
      } catch (_e) {
        /* noop */
      }
      try {
        incRefreshReuse('detected');
        incSecurityEvent('reuse');
      } catch (_e) {
        /* noop */
      }
      if (isLockoutEnabled()) {
        try {
          await lockout.lock(user.id);
          incSecurityEvent('lockout');
        } catch (_e) {
          /* noop */
        }
      }
      throw new ServiceError('token_reuse_detected', 401);
    }
    throw new ServiceError('invalid_token', 401);
  }

  const inactive = await UserStatus.findOne({ where: { alias: 'INACTIVE' } });
  if (inactive && user.status_id === inactive.id) {
    throw new ServiceError('account_locked', 401);
  }

  // Mark provided refresh as used (single-use semantics)
  try {
    if (payload?.jti)
      await markUsed({
        sub: payload.sub,
        ver: payload.ver,
        jti: payload.jti,
        exp: payload.exp,
      });
  } catch (_e) {
    /* noop */
  }

  // Optional integrity check: ensure provided jti matches remembered current
  try {
    const cur = await currentJti({ sub: payload.sub, ver: payload.ver });
    if (cur && payload?.jti && cur !== payload.jti) {
      // State loss or parallel rotation — record security event but proceed
      incSecurityEvent('state_loss');
    }
  } catch (_e) {
    /* noop */
  }

  // Rotate version to invalidate previous refresh token
  await user.increment('token_version');
  const updated = await user.reload();
  const tokens = issueTokens(updated);
  return { user: updated, ...tokens };
}

export default {
  verifyCredentials,
  issueTokens,
  rotateTokens,
};
