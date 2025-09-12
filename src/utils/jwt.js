import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import ServiceError from '../errors/ServiceError.js';
import {
  JWT_SECRET,
  ACCESS_TTL,
  REFRESH_TTL,
  JWT_ALG,
  JWT_ISS,
  JWT_AUD,
  JWT_PRIVATE_KEY,
  JWT_PUBLIC_KEYS,
  JWT_KID,
} from '../config/auth.js';

/* ---------- key management ------------------------------------------------ */
function getSigningOptions() {
  const alg = JWT_ALG;
  // If asymmetric: require private key
  if (/^(RS|ES|EdDSA)/.test(alg)) {
    if (!JWT_PRIVATE_KEY) throw new Error('Missing JWT_PRIVATE_KEY');
    return { key: JWT_PRIVATE_KEY, alg, kid: JWT_KID || 'k1' };
  }
  // Symmetric HS*
  if (!JWT_SECRET) throw new Error('Missing JWT_SECRET');
  return { key: JWT_SECRET, alg, kid: JWT_KID || undefined };
}

function getVerifyKey(headerKid) {
  const alg = JWT_ALG;
  // Asymmetric: pick by kid
  if (/^(RS|ES|EdDSA)/.test(alg)) {
    if (Array.isArray(JWT_PUBLIC_KEYS) && JWT_PUBLIC_KEYS.length) {
      const found =
        JWT_PUBLIC_KEYS.find((k) => k.kid === headerKid) || JWT_PUBLIC_KEYS[0];
      return found.key;
    }
    // fallback to private (verify still works with public preferred)
    if (JWT_PRIVATE_KEY) return JWT_PRIVATE_KEY;
    throw new Error('No JWT public keys configured');
  }
  // Symmetric
  return JWT_SECRET;
}

/* ---------- sign helpers -------------------------------------------------- */
export function signAccessToken(user) {
  const s = getSigningOptions();
  const opts = {
    algorithm: s.alg,
    expiresIn: ACCESS_TTL,
    issuer: JWT_ISS,
    audience: JWT_AUD,
  };
  if (s.kid) opts.header = { kid: s.kid };
  return jwt.sign({ sub: user.id }, s.key, opts);
}

export function signRefreshTokenWithJti(user, jti) {
  const _jti = jti || uuidv4();
  const s = getSigningOptions();
  const opts = {
    algorithm: s.alg,
    expiresIn: REFRESH_TTL,
    issuer: JWT_ISS,
    audience: JWT_AUD,
    jwtid: _jti,
  };
  if (s.kid) opts.header = { kid: s.kid };
  return jwt.sign(
    { sub: user.id, type: 'refresh', ver: user.token_version },
    s.key,
    opts
  );
}

export function signRefreshToken(user) {
  const jti = uuidv4();
  return signRefreshTokenWithJti(user, jti);
}

/* ---------- verify helpers ------------------------------------------------ */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.decode(token, { complete: true }) || {};
    const key = getVerifyKey(decoded?.header?.kid);
    return jwt.verify(token, key, {
      algorithms: [JWT_ALG],
      issuer: JWT_ISS,
      audience: JWT_AUD,
    });
  } catch (_e) {
    // Security/UX: do not leak JWT verification details
    throw new ServiceError('invalid_token', 401);
  }
}

export function verifyRefreshToken(token) {
  let payload;
  try {
    const decoded = jwt.decode(token, { complete: true }) || {};
    const key = getVerifyKey(decoded?.header?.kid);
    payload = jwt.verify(token, key, {
      algorithms: [JWT_ALG],
      issuer: JWT_ISS,
      audience: JWT_AUD,
      complete: false,
    });
  } catch (_e) {
    // Security/UX: normalize verification failures
    throw new ServiceError('invalid_token', 401);
  }
  if (payload.type !== 'refresh') {
    throw new ServiceError('invalid_token_type', 401);
  }
  return payload;
}

export function decodeJwt(token) {
  try {
    return jwt.decode(token, { complete: false });
  } catch {
    return null;
  }
}
