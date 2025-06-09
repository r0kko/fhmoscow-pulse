import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import User from '../models/user.js';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';
const JWT_SECRET = process.env.JWT_SECRET;

/* --------------------- helpers ------------------------------------------- */
function sign(payload, expiresIn) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verify(token, opts = {}) {
  return jwt.verify(token, JWT_SECRET, opts);
}

/* ------------------- service implementation ------------------------------ */
async function verifyCredentials(email, password) {
  const user = await User.scope('withPassword').findOne({ where: { email } });
  if (!user) throw new Error('invalid_credentials');

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('invalid_credentials');

  return user;
}

function issueTokens(user) {
  const accessToken = sign({ sub: user.id }, ACCESS_TTL);
  const refreshToken = sign({ sub: user.id, type: 'refresh' }, REFRESH_TTL);
  return { accessToken, refreshToken };
}

async function rotateTokens(refreshToken) {
  const payload = verify(refreshToken);
  if (payload.type !== 'refresh') throw new Error('invalid_token');

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
