import bcrypt from 'bcryptjs';

import User from '../models/user.js';
import { UserStatus } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { LOGIN_MAX_ATTEMPTS } from '../config/auth.js';

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

  // Temporary lockout check
  if (await lockout.isLocked(user.id)) {
    const ttlMs = await lockout.getTtlMs(user.id);
    const err = new ServiceError('account_locked', 401);
    if (ttlMs > 0) err.retryAfter = Math.ceil(ttlMs / 1000);
    throw err;
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
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
    throw new ServiceError('invalid_credentials', 401);
  }

  await attempts.clear(user.id);

  return user;
}

function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return { accessToken, refreshToken };
}

async function rotateTokens(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);

  const user = await User.findByPk(payload.sub);
  if (!user) throw new ServiceError('user_not_found', 401);

  // Reject if token version was rotated already
  if (typeof payload.ver !== 'number' || payload.ver !== user.token_version) {
    throw new ServiceError('invalid_token', 401);
  }

  const inactive = await UserStatus.findOne({ where: { alias: 'INACTIVE' } });
  if (inactive && user.status_id === inactive.id) {
    throw new ServiceError('account_locked', 401);
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
