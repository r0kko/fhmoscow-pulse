import jwt from 'jsonwebtoken';

const {
  JWT_SECRET,
  JWT_ACCESS_TTL = '15m',
  JWT_REFRESH_TTL = '30d',
  JWT_ALG = 'HS256',
} = process.env;

/* ---------- sign helpers -------------------------------------------------- */
export function signAccessToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, {
    algorithm: JWT_ALG,
    expiresIn: JWT_ACCESS_TTL,
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, JWT_SECRET, {
    algorithm: JWT_ALG,
    expiresIn: JWT_REFRESH_TTL,
  });
}

/* ---------- verify helpers ------------------------------------------------ */
export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALG] });
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALG] });
  if (payload.type !== 'refresh') {
    throw new Error('invalid_token_type');
  }
  return payload;
}
