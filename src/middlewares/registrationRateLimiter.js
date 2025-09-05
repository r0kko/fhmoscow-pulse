import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { incRateLimited } from '../config/metrics.js';
import { isRedisWritable } from '../config/redis.js';
import { sendError } from '../utils/api.js';

import RedisRateLimitStore from './stores/redisRateLimitStore.js';

function regKey(req) {
  const ip = req.ip || req.connection?.remoteAddress || '';
  const email = (req.body?.email || '').toString().trim().toLowerCase();
  const ipKey = ipKeyGenerator(ip, 64);
  return `ip:${ipKey}|email:${email || 'unknown'}`;
}

/**
 * Rate limiter for registration endpoints.
 * Defaults increased; still protective for abuse.
 */
const windowMs = parseInt(process.env.REGISTRATION_RATE_WINDOW_MS || '3600000');
const max = parseInt(process.env.REGISTRATION_RATE_MAX || '30');
const store =
  process.env.RATE_LIMIT_USE_REDIS === 'true' && isRedisWritable()
    ? new RedisRateLimitStore({ prefix: 'rate:registration' })
    : undefined;

export default rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: regKey,
  store,
  skip: (req) => {
    const method = (req.method || 'POST').toUpperCase();
    return method === 'OPTIONS' || method === 'HEAD';
  },
  handler: (req, res, _next, options) => {
    incRateLimited('registration');
    return sendError(res, {
      status: 429,
      code: 'rate_limited',
      retryAfter: Math.ceil((options?.windowMs || windowMs) / 1000),
    });
  },
});
