import bcrypt from 'bcryptjs';

import User from '../models/user.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

/* ------------------- service implementation ------------------------------ */
async function verifyCredentials(phone, password) {
  const user = await User.scope('withPassword').findOne({ where: { phone } });
  if (!user) throw new Error('invalid_credentials');

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('invalid_credentials');

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
