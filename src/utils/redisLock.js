import { randomUUID } from 'crypto';

import redisClient, { isRedisWritable } from '../config/redis.js';

// Simple Redis-based distributed lock using SET NX PX and value check on release
// Usage:
//   await withRedisLock('lock:job:clubSync', 30 * 60_000, async () => { ... })

const RELEASE_LUA = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
`;

export async function tryAcquireLock(key, ttlMs, value = randomUUID()) {
  try {
    const ok = await redisClient.set(key, value, { NX: true, PX: ttlMs });
    if (ok) {
      return { acquired: true, value };
    }
    return { acquired: false };
  } catch (err) {
    // If Redis is unavailable or not writable, report not acquired to avoid false safety
    return { acquired: false, error: err };
  }
}

export async function releaseLock(key, value) {
  try {
    await redisClient.eval(RELEASE_LUA, { keys: [key], arguments: [value] });
  } catch {
    // best-effort release
  }
}

export async function withRedisLock(key, ttlMs, fn, { onBusy } = {}) {
  // If Redis not available/writable, allow function to run to avoid blocking
  const holder = randomUUID();
  try {
    const res = await tryAcquireLock(key, ttlMs, holder);
    if (res.acquired) {
      try {
        return await fn();
      } finally {
        await releaseLock(key, holder);
      }
    }
    // Fallbacks: connection errors or read-only Redis — run without lock
    if (res.error || isRedisWritable() === false) {
      return await fn();
    }
    if (typeof onBusy === 'function') return onBusy();
    return null;
  } catch {
    // Last-resort fallback: execute without lock
    return await fn();
  }
}

export function buildJobLockKey(name) {
  return `lock:job:${name}`;
}

// ADMIN: force delete a lock regardless of holder value (unsafe; for manual recovery)
export async function forceDeleteLock(key) {
  try {
    await redisClient.del(key);
    return true;
  } catch {
    return false;
  }
}

export default { withRedisLock, tryAcquireLock, releaseLock, buildJobLockKey };
