import redis from '../config/redis.js';
import { LOGIN_LOCKOUT_MS } from '../config/auth.js';

const PREFIX = 'login_block:';

function key(id) {
  return `${PREFIX}${id}`;
}

export async function lock(id, ttlMs = LOGIN_LOCKOUT_MS) {
  // Best-effort; ignore READONLY
  try {
    await redis.set(key(id), '1', { PX: ttlMs });
  } catch (err) {
    if (!err?.message?.includes('READONLY')) throw err;
  }
}

export async function isLocked(id) {
  try {
    const v = await redis.get(key(id));
    return Boolean(v);
  } catch (err) {
    if (err?.message?.includes('READONLY')) return false;
    throw err;
  }
}

export async function getTtlMs(id) {
  try {
    // node-redis v4: pTTL returns remaining ttl in ms, or -1/-2 for no expire/not found
    const ttl = await redis.pTTL(key(id));
    return ttl > 0 ? ttl : 0;
  } catch (err) {
    if (err?.message?.includes('READONLY')) return 0;
    throw err;
  }
}

export default { lock, isLocked };
