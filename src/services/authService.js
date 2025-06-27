import bcrypt from 'bcryptjs';

import User from '../models/user.js';
import { UserStatus } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

import * as attempts from './loginAttempts.js';

/* ------------------- service implementation ------------------------------ */
async function verifyCredentials(phone, password) {
  const user = await User.scope('withPassword').findOne({ where: { phone } });
  if (!user) throw new ServiceError('invalid_credentials', 401);

  const inactive = await UserStatus.findOne({ where: { alias: 'INACTIVE' } });
  if (inactive && user.status_id === inactive.id) {
    throw new ServiceError('account_locked', 401);
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    const count = await attempts.markFailed(user.id);
    if (count >= 5 && inactive) {
      await user.update({ status_id: inactive.id });
      await attempts.clear(user.id);
      throw new ServiceError('account_locked', 401);
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

  const tokens = issueTokens(user);
  return { user, ...tokens };
}

export default {
  verifyCredentials,
  issueTokens,
  rotateTokens,
};
