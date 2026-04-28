import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { incRateLimited } from '../config/metrics.js';
import { isRedisWritable } from '../config/redis.js';
import { isRateLimitEnabled } from '../config/featureFlags.js';
import { sendError } from '../utils/api.js';
import { getClientIp } from '../utils/clientIp.js';
import { hashRateLimitIdentifier } from '../utils/rateLimitKeys.js';

import RedisRateLimitStore from './stores/redisRateLimitStore.js';

function exportKey(req) {
  const userKey = req.user?.id
    ? `u:${hashRateLimitIdentifier(req.user.id)}`
    : `ip:${ipKeyGenerator(getClientIp(req), 64)}`;
  const teamKey = hashRateLimitIdentifier(req.params?.id || 'unknown');
  return `${userKey}|team:${teamKey || 'unknown'}`;
}

const enabled = isRateLimitEnabled('match_protocol_export');
const windowMs = parseInt(
  process.env.MATCH_PROTOCOL_EXPORT_RATE_WINDOW_MS || '300000',
  10
);
const max = parseInt(process.env.MATCH_PROTOCOL_EXPORT_RATE_MAX || '5', 10);
const store =
  enabled && process.env.RATE_LIMIT_USE_REDIS === 'true' && isRedisWritable()
    ? new RedisRateLimitStore({ prefix: 'rate:match_protocol_export' })
    : undefined;

const middleware = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: exportKey,
  store,
  skip: (req) => {
    const method = (req.method || 'POST').toUpperCase();
    if (method === 'OPTIONS' || method === 'HEAD') return true;
    return !enabled;
  },
  handler: (_req, res, _next, options) => {
    incRateLimited('match_protocol_export');
    return sendError(res, {
      status: 429,
      code: 'rate_limited',
      retryAfter: Math.ceil((options?.windowMs || windowMs) / 1000),
    });
  },
});

export default enabled ? middleware : (_req, _res, next) => next();
