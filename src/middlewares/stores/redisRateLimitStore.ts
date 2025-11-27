import redisClient, { type RedisClientInstance } from '../../config/redis.js';

import type {
  ClientRateLimitInfo,
  IncrementResponse,
  Options,
  Store,
} from 'express-rate-limit';

interface RedisRateLimitStoreOptions {
  prefix?: string;
  client?: RedisClientInstance;
}

const DEFAULT_WINDOW_MS = 60_000;

/**
 * Minimal Redis store for express-rate-limit@8 using existing redis client.
 * Provides per-key counters with TTL equal to windowMs.
 */
export default class RedisRateLimitStore implements Store {
  private readonly client: RedisClientInstance;
  readonly prefix: string;
  private windowMs: number;
  readonly localKeys = false;
  private readonly prefixString: string;

  constructor({
    prefix = 'rate',
    client = redisClient,
  }: RedisRateLimitStoreOptions = {}) {
    this.client = client;
    this.prefix = prefix;
    this.windowMs = DEFAULT_WINDOW_MS;
    this.prefixString = `${this.prefix}:`;
  }

  init(options: Options): void {
    this.windowMs = Number(options.windowMs || this.windowMs);
  }

  private key(key: string): string {
    return `${this.prefixString}${key}`;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const redisKey = this.key(key);
    const execResult = await this.client
      .multi()
      .get(redisKey)
      .pTTL(redisKey)
      .exec();

    const [rawCount, rawTtl] = Array.isArray(execResult)
      ? execResult
      : [undefined, undefined];
    const countStr = Array.isArray(rawCount) ? rawCount[1] : rawCount;
    const ttlMs = Array.isArray(rawTtl) ? rawTtl[1] : rawTtl;
    const totalHits = Number(countStr) || 0;
    if (totalHits === 0) {
      return { totalHits: 0, resetTime: undefined };
    }
    const ttlDuration = Number(ttlMs);
    const resetTime =
      ttlDuration > 0 ? new Date(Date.now() + ttlDuration) : undefined;
    return { totalHits, resetTime };
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redisKey = this.key(key);
    const execResult = await this.client
      .multi()
      .incr(redisKey)
      .pTTL(redisKey)
      .exec();

    const [rawTotalHits, rawTtl] = Array.isArray(execResult)
      ? execResult
      : [undefined, undefined];
    const totalHits = Number(
      Array.isArray(rawTotalHits) ? rawTotalHits[1] : rawTotalHits
    );
    const ttlMs = Number(Array.isArray(rawTtl) ? rawTtl[1] : rawTtl);

    if (Number.isNaN(totalHits)) {
      return { totalHits: 0, resetTime: undefined };
    }

    if (totalHits === 1 || ttlMs < 0) {
      await this.client.pExpire(redisKey, this.windowMs);
    }

    const ttlDuration = ttlMs > 0 ? ttlMs : this.windowMs;
    const resetTime = new Date(Date.now() + ttlDuration);
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.key(key);
    try {
      const count = await this.client.decr(redisKey);
      if (Number(count) <= 0) {
        await this.client.del(redisKey);
      }
    } catch {
      /* ignore */
    }
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = this.key(key);
    await this.client.del(redisKey);
  }

  async resetAll(): Promise<void> {
    // Dangerous on large keyspaces; intentionally not implemented
  }

  async shutdown(): Promise<void> {
    // No-op: the shared redis client lifecycle is managed elsewhere
  }
}
