import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { incRateLimited } from '../config/metrics.js';
import { isRedisWritable } from '../config/redis.js';
import { sendError } from '../utils/api.js';
import { isRateLimitEnabled } from '../config/featureFlags.js';
import { getClientIp } from '../utils/clientIp.js';
import { hashRateLimitIdentifier } from '../utils/rateLimitKeys.js';

import RedisRateLimitStore from './stores/redisRateLimitStore.js';

function inviteKey(req) {
  const ip = getClientIp(req);
  const targetUser = hashRateLimitIdentifier(req.params?.id || 'unknown');
  const ipKey = ipKeyGenerator(ip, 64);
  return `ip:${ipKey}|target:${targetUser || 'unknown'}`;
}

const enabled = isRateLimitEnabled('user_invite');
const windowMs = parseInt(process.env.USER_INVITE_RATE_WINDOW_MS || '600000'); // 10 min
const max = parseInt(process.env.USER_INVITE_RATE_MAX || '5');
const store =
  enabled && process.env.RATE_LIMIT_USE_REDIS === 'true' && isRedisWritable()
    ? new RedisRateLimitStore({ prefix: 'rate:user_invite' })
    : undefined;

const middleware = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: inviteKey,
  store,
  skip: (req) => {
    const method = (req.method || 'POST').toUpperCase();
    if (method === 'OPTIONS' || method === 'HEAD') return true;
    return !enabled;
  },
  handler: (_req, res, _next, options) => {
    incRateLimited('user_invite');
    return sendError(res, {
      status: 429,
      code: 'rate_limited',
      retryAfter: Math.ceil((options?.windowMs || windowMs) / 1000),
    });
  },
});

export default enabled ? middleware : (_req, _res, next) => next();
