import redisClient from '../../config/redis.js';

/**
 * Minimal Redis store for express-rate-limit@8 using existing redis client.
 * Provides per-key counters with TTL equal to windowMs.
 */
export default class RedisRateLimitStore {
  constructor({ prefix = 'rate', client = redisClient } = {}) {
    this.client = client;
    this.prefix = prefix;
    this.windowMs = 60_000;
    // Keys incremented in one instance affect others => distributed
    this.localKeys = false;
    this.prefixString = `${this.prefix}:`;
  }

  init(options) {
    this.windowMs = Number(options.windowMs || this.windowMs);
  }

  key(key) {
    return `${this.prefixString}${key}`;
  }

  async get(key) {
    const k = this.key(key);
    const [countStr, pttl] = await this.client.multi().get(k).pTTL(k).exec();
    const totalHits = Number(countStr) || 0;
    const ttlMs = Number(pttl);
    const resetTime = ttlMs > 0 ? new Date(Date.now() + ttlMs) : undefined;
    return { totalHits, resetTime };
  }

  async increment(key) {
    const k = this.key(key);
    const [count, pttl] = await this.client.multi().incr(k).pTTL(k).exec();
    // Set expiry on first hit
    if (Number(count) === 1 || Number(pttl) < 0) {
      await this.client.pExpire(k, this.windowMs);
    }
    const ttlMs = Number(pttl) > 0 ? Number(pttl) : this.windowMs;
    const resetTime = new Date(Date.now() + ttlMs);
    return { totalHits: Number(count), resetTime };
  }

  async decrement(key) {
    const k = this.key(key);
    try {
      const count = await this.client.decr(k);
      if (Number(count) <= 0) await this.client.del(k);
    } catch (_) {
      /* ignore */
    }
  }

  async resetKey(key) {
    const k = this.key(key);
    await this.client.del(k);
  }

  async resetAll() {
    // Dangerous on large keyspaces; intentionally not implemented
  }

  async shutdown() {
    // No-op: the shared redis client lifecycle is managed elsewhere
  }
}
