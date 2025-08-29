import redis from '../config/redis.js';
import { LOGIN_ATTEMPT_WINDOW_MS } from '../config/auth.js';

const WINDOW_MS = LOGIN_ATTEMPT_WINDOW_MS; // attempt window
const PREFIX = 'login_attempts:';

function key(id) {
  return `${PREFIX}${id}`;
}

export function isReadonlyError(err) {
  return err?.message?.includes('READONLY');
}

export async function markFailed(id, now = Date.now()) {
  const k = key(id);
  try {
    const data = await redis.get(k);
    if (!data) {
      await redis.set(k, JSON.stringify({ count: 1, first: now }), {
        PX: WINDOW_MS,
      });
      return 1;
    }
    const entry = JSON.parse(data);
    if (now - entry.first > WINDOW_MS) {
      await redis.set(k, JSON.stringify({ count: 1, first: now }), {
        PX: WINDOW_MS,
      });
      return 1;
    }
    entry.count += 1;
    const ttl = WINDOW_MS - (now - entry.first);
    await redis.set(k, JSON.stringify(entry), { PX: ttl });
    return entry.count;
  } catch (err) {
    if (isReadonlyError(err)) {
      return 1;
    }
    throw err;
  }
}

export async function clear(id) {
  try {
    await redis.del(key(id));
  } catch (err) {
    if (!isReadonlyError(err)) throw err;
  }
}

export async function get(id, now = Date.now()) {
  try {
    const data = await redis.get(key(id));
    if (!data) return 0;
    const entry = JSON.parse(data);
    if (now - entry.first > WINDOW_MS) {
      await redis.del(key(id));
      return 0;
    }
    return entry.count;
  } catch (err) {
    if (isReadonlyError(err)) {
      return 0;
    }
    throw err;
  }
}

export async function _reset() {
  try {
    const keys = await redis.keys(`${PREFIX}*`);
    if (keys.length) await redis.del(keys);
  } catch (err) {
    if (!isReadonlyError(err)) throw err;
  }
}

export { WINDOW_MS };
