import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { incRateLimited } from '../config/metrics.js';
import { isRedisWritable } from '../config/redis.js';
import { sendError } from '../utils/api.js';
import { isRateLimitEnabled } from '../config/featureFlags.js';

import RedisRateLimitStore from './stores/redisRateLimitStore.js';

function clientKey(req) {
  // Prefer per-user buckets for authenticated requests, else IP subnet key
  if (req.user?.id) return `u:${req.user.id}`;
  const ip = req.ip || req.connection?.remoteAddress || '';
  return `ip:${ipKeyGenerator(ip, 64)}`;
}

/**
 * Global rate limiter — disabled by default for better UX.
 * Expect DDoS/throttle at the edge (CDN/WAF). Can be re‑enabled via env.
 */
const enabled = isRateLimitEnabled('global');
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const max = parseInt(process.env.RATE_LIMIT_MAX || '1200');

const store =
  enabled && process.env.RATE_LIMIT_USE_REDIS === 'true' && isRedisWritable()
    ? new RedisRateLimitStore({ prefix: 'rate:global' })
    : undefined;

const middleware = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  store,
  handler: (req, res, _next, options) => {
    incRateLimited('global');
    return sendError(res, {
      status: 429,
      code: 'rate_limited',
      retryAfter: Math.ceil((options?.windowMs || windowMs) / 1000),
    });
  },
  skip: (req) => {
    // Skip CORS preflight and HEAD
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS' || method === 'HEAD') return true;
    // Do not rate-limit health and CSRF token endpoints
    const p = req.path || '';
    if (
      p === '/health' ||
      p === '/ready' ||
      p === '/live' ||
      p === '/csrf-token' ||
      p === '/metrics' ||
      p === '/favicon.ico'
    )
      return true;
    // Avoid hammering API docs if enabled
    if (p.startsWith('/api-docs')) return true;
    return !enabled; // fully skip when disabled
  },
});

export default enabled
  ? middleware
  : (_req, _res, next) => next();
