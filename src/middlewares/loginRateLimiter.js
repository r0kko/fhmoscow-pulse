import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { incRateLimited } from '../config/metrics.js';
import { isRedisWritable } from '../config/redis.js';
import { sendError } from '../utils/api.js';

import RedisRateLimitStore from './stores/redisRateLimitStore.js';

function loginKey(req) {
  const ip = req.ip || req.connection?.remoteAddress || '';
  const acct = (req.body?.phone || req.body?.email || '').toString().trim();
  // Pair IP with account identifier to reduce NAT collisions while
  // still constraining per-source
  const ipKey = ipKeyGenerator(ip, 64);
  return `ip:${ipKey}|acct:${acct || 'unknown'}`;
}

// Conservative per-IP limiter for login endpoint
const windowMs = parseInt(process.env.LOGIN_RATE_WINDOW_MS || '60000'); // 1 min
const max = parseInt(process.env.LOGIN_RATE_MAX || '30');
const store =
  process.env.RATE_LIMIT_USE_REDIS === 'true' && isRedisWritable()
    ? new RedisRateLimitStore({ prefix: 'rate:login' })
    : undefined;

export default rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: loginKey,
  store,
  // Do not count successful logins towards the limit
  skipSuccessfulRequests: true,
  skip: (req) => {
    const method = (req.method || 'POST').toUpperCase();
    return method === 'OPTIONS' || method === 'HEAD';
  },
  handler: (req, res, _next, options) => {
    incRateLimited('login');
    return sendError(res, {
      status: 429,
      code: 'rate_limited',
      retryAfter: Math.ceil((options?.windowMs || windowMs) / 1000),
    });
  },
});
