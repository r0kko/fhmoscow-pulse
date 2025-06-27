import redis from '../config/redis.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const PREFIX = 'login_attempts:';

function key(id) {
  return `${PREFIX}${id}`;
}

export async function markFailed(id, now = Date.now()) {
  const k = key(id);
  const data = await redis.get(k);
  if (!data) {
    await redis.set(k, JSON.stringify({ count: 1, first: now }), { PX: WINDOW_MS });
    return 1;
  }
  const entry = JSON.parse(data);
  if (now - entry.first > WINDOW_MS) {
    await redis.set(k, JSON.stringify({ count: 1, first: now }), { PX: WINDOW_MS });
    return 1;
  }
  entry.count += 1;
  const ttl = WINDOW_MS - (now - entry.first);
  await redis.set(k, JSON.stringify(entry), { PX: ttl });
  return entry.count;
}

export async function clear(id) {
  await redis.del(key(id));
}

export async function get(id, now = Date.now()) {
  const data = await redis.get(key(id));
  if (!data) return 0;
  const entry = JSON.parse(data);
  if (now - entry.first > WINDOW_MS) {
    await redis.del(key(id));
    return 0;
  }
  return entry.count;
}

export async function _reset() {
  const keys = await redis.keys(`${PREFIX}*`);
  if (keys.length) await redis.del(keys);
}

export { WINDOW_MS };
