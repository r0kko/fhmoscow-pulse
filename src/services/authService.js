import bcrypt from 'bcryptjs';

import User from '../models/user.js';
import { UserStatus } from '../models/index.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

/* ------------------- service implementation ------------------------------ */
async function verifyCredentials(phone, password) {
  const user = await User.scope('withPassword').findOne({ where: { phone } });
  if (!user) throw new Error('invalid_credentials');

  const inactive = await UserStatus.findOne({ where: { alias: 'INACTIVE' } });
  if (inactive && user.status_id === inactive.id) {
    throw new Error('account_locked');
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    const attempts = (user.login_attempts || 0) + 1;
    const updates = { login_attempts: attempts };
    if (attempts >= 3 && inactive) {
      updates.status_id = inactive.id;
    }
    await user.update(updates);
    if (attempts >= 3 && inactive) {
      throw new Error('account_locked');
    }
    throw new Error('invalid_credentials');
  }

  if (user.login_attempts) {
    await user.update({ login_attempts: 0 });
  }

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
  if (!user) throw new Error('user_not_found');

  const tokens = issueTokens(user);
  return { user, ...tokens };
}

export default {
  verifyCredentials,
  issueTokens,
  rotateTokens,
};
