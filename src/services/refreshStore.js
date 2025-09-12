import redis from '../config/redis.js';

function keyUsed(sub, ver, jti) {
  return `auth:rt:used:${sub}:${ver}:${jti}`;
}
function keyCurrent(sub, ver) {
  return `auth:rt:current:${sub}:${ver}`;
}

function ttlSecondsFromExp(exp) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(1, Number(exp || 0) - now);
    if (!Number.isFinite(ttl)) return 0;
    return ttl;
  } catch {
    return 0;
  }
}

export async function rememberIssued({ sub, ver, jti, exp }) {
  const ttl = ttlSecondsFromExp(exp);
  try {
    if (ttl > 0) await redis.set(keyCurrent(sub, ver), jti, { EX: ttl });
  } catch (_e) {
    /* noop */
  }
}

export async function markUsed({ sub, ver, jti, exp }) {
  const ttl = ttlSecondsFromExp(exp);
  try {
    // Mark concrete token as used (single-use semantics)
    if (ttl > 0) await redis.set(keyUsed(sub, ver, jti), '1', { EX: ttl });
  } catch (_e) {
    /* noop */
  }
}

export async function isUsed({ sub, ver, jti }) {
  try {
    const v = await redis.get(keyUsed(sub, ver, jti));
    return v === '1';
  } catch (_e) {
    return false;
  }
}

export async function currentJti({ sub, ver }) {
  try {
    return (await redis.get(keyCurrent(sub, ver))) || null;
  } catch (_e) {
    return null;
  }
}

export default { rememberIssued, markUsed, isUsed, currentJti };
