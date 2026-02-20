import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { incRateLimited } from '../config/metrics.js';
import { isRedisWritable } from '../config/redis.js';
import { isRateLimitEnabled } from '../config/featureFlags.js';
import { sendError } from '../utils/api.js';
import { getClientIp } from '../utils/clientIp.js';
import { hashRateLimitIdentifier } from '../utils/rateLimitKeys.js';

import RedisRateLimitStore from './stores/redisRateLimitStore.js';

function verifyKey(req) {
  const ip = getClientIp(req);
  const ipKey = ipKeyGenerator(ip, 64);
  const token =
    req.get?.('X-Verify-Token') ||
    req.get?.('x-verify-token') ||
    req.query?.t ||
    '';
  const tokenHash = hashRateLimitIdentifier(String(token || ''));
  return `ip:${ipKey}|t:${tokenHash.slice(0, 24) || 'unknown'}`;
}

function shortLinkKey(req) {
  const ip = getClientIp(req);
  const ipKey = ipKeyGenerator(ip, 64);
  const codeHash = hashRateLimitIdentifier(String(req.params?.code || ''));
  return `ip:${ipKey}|c:${codeHash.slice(0, 24) || 'unknown'}`;
}

function createLimiter({
  kind,
  prefix,
  windowMsEnv,
  maxEnv,
  windowMsDefault,
  maxDefault,
  keyGenerator,
}) {
  const enabled = isRateLimitEnabled(kind);
  const windowMs = parseInt(
    process.env[windowMsEnv] || String(windowMsDefault),
    10
  );
  const max = parseInt(process.env[maxEnv] || String(maxDefault), 10);
  const store =
    enabled && process.env.RATE_LIMIT_USE_REDIS === 'true' && isRedisWritable()
      ? new RedisRateLimitStore({ prefix })
      : undefined;

  if (!enabled) return (_req, _res, next) => next();

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    store,
    skip: (req) => {
      const method = (req.method || 'GET').toUpperCase();
      return method === 'OPTIONS' || method === 'HEAD';
    },
    handler: (req, res, _next, options) => {
      incRateLimited(kind);
      return sendError(res, {
        status: 429,
        code: 'rate_limited',
        retryAfter: Math.ceil((options?.windowMs || windowMs) / 1000),
      });
    },
  });
}

export const verifyRateLimiter = createLimiter({
  kind: 'verify',
  prefix: 'rate:verify',
  windowMsEnv: 'VERIFY_RATE_WINDOW_MS',
  maxEnv: 'VERIFY_RATE_MAX',
  windowMsDefault: 60_000,
  maxDefault: 120,
  keyGenerator: verifyKey,
});

export const shortLinkRateLimiter = createLimiter({
  kind: 'shortlink',
  prefix: 'rate:shortlink',
  windowMsEnv: 'SHORTLINK_RATE_WINDOW_MS',
  maxEnv: 'SHORTLINK_RATE_MAX',
  windowMsDefault: 60_000,
  maxDefault: 240,
  keyGenerator: shortLinkKey,
});

export default { verifyRateLimiter, shortLinkRateLimiter };
