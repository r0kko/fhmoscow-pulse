import jwt from 'jsonwebtoken';

import ServiceError from '../errors/ServiceError.js';
import {
  JWT_SECRET,
  ACCESS_TTL,
  REFRESH_TTL,
  JWT_ALG,
  JWT_ISS,
  JWT_AUD,
} from '../config/auth.js';

/* ---------- sign helpers -------------------------------------------------- */
export function signAccessToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, {
    algorithm: JWT_ALG,
    expiresIn: ACCESS_TTL,
    issuer: JWT_ISS,
    audience: JWT_AUD,
  });
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh', ver: user.token_version },
    JWT_SECRET,
    {
      algorithm: JWT_ALG,
      expiresIn: REFRESH_TTL,
      issuer: JWT_ISS,
      audience: JWT_AUD,
    }
  );
}

/* ---------- verify helpers ------------------------------------------------ */
export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALG],
    issuer: JWT_ISS,
    audience: JWT_AUD,
  });
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALG],
    issuer: JWT_ISS,
    audience: JWT_AUD,
  });
  if (payload.type !== 'refresh') {
    throw new ServiceError('invalid_token_type', 401);
  }
  return payload;
}
