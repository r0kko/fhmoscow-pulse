import crypto from 'crypto';

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { incRateLimited } from '../config/metrics.js';
import { isRedisWritable } from '../config/redis.js';
import { isRateLimitEnabled } from '../config/featureFlags.js';
import { sendError } from '../utils/api.js';
import { getClientIp } from '../utils/clientIp.js';

import RedisRateLimitStore from './stores/redisRateLimitStore.js';

const enabled = isRateLimitEnabled('password_reset');

function getRateLimitSecret() {
  return (
    process.env.RATE_LIMIT_KEY_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    ''
  );
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashEmail(value) {
  const normalized = normalizeEmail(value);
  if (!normalized) return 'unknown';
  const secret = getRateLimitSecret();
  if (!secret) {
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(normalized, 'utf8')
    .digest('hex');
}

function resetIpKey(req) {
  const ip = getClientIp(req);
  return ipKeyGenerator(ip, 64);
}

function startEmailKey(req) {
  const emailHash = hashEmail(req.body?.email);
  return `email:${emailHash}`;
}

function startIpKey(req) {
  return `ip:${resetIpKey(req)}`;
}

function finishKey(req) {
  const emailHash = hashEmail(req.body?.email);
  return `ip:${resetIpKey(req)}|email:${emailHash}`;
}

function buildStore(prefix) {
  return enabled && process.env.RATE_LIMIT_USE_REDIS === 'true' && isRedisWritable()
    ? new RedisRateLimitStore({ prefix })
    : undefined;
}

function skipWhenDisabled(req, fallbackMethod = 'POST') {
  const method = (req.method || fallbackMethod).toUpperCase();
  if (method === 'OPTIONS' || method === 'HEAD') return true;
  return !enabled;
}

function createHandler(kind, windowMs) {
  return (req, res, _next, options) => {
    incRateLimited(kind);
    return sendError(res, {
      status: 429,
      code: 'rate_limited',
      retryAfter: Math.ceil((options?.windowMs || windowMs) / 1000),
    });
  };
}

const startEmailWindowMs = parseInt(
  process.env.PASSWORD_RESET_START_EMAIL_RATE_WINDOW_MS || '3600000',
  10
);
const startEmailMax = parseInt(
  process.env.PASSWORD_RESET_START_EMAIL_RATE_MAX || '3',
  10
);
const startIpWindowMs = parseInt(
  process.env.PASSWORD_RESET_START_IP_RATE_WINDOW_MS || '3600000',
  10
);
const startIpMax = parseInt(
  process.env.PASSWORD_RESET_START_IP_RATE_MAX || '10',
  10
);
const finishWindowMs = parseInt(
  process.env.PASSWORD_RESET_FINISH_RATE_WINDOW_MS || '900000',
  10
);
const finishMax = parseInt(process.env.PASSWORD_RESET_FINISH_RATE_MAX || '10', 10);

export const passwordResetStartEmailRateLimiter = enabled
  ? rateLimit({
      windowMs: startEmailWindowMs,
      max: startEmailMax,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: startEmailKey,
      store: buildStore('rate:password_reset:start:email'),
      skip: (req) => skipWhenDisabled(req),
      handler: createHandler('password_reset_start_email', startEmailWindowMs),
    })
  : (_req, _res, next) => next();

export const passwordResetStartIpRateLimiter = enabled
  ? rateLimit({
      windowMs: startIpWindowMs,
      max: startIpMax,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: startIpKey,
      store: buildStore('rate:password_reset:start:ip'),
      skip: (req) => skipWhenDisabled(req),
      handler: createHandler('password_reset_start_ip', startIpWindowMs),
    })
  : (_req, _res, next) => next();

export const passwordResetFinishRateLimiter = enabled
  ? rateLimit({
      windowMs: finishWindowMs,
      max: finishMax,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: finishKey,
      store: buildStore('rate:password_reset:finish'),
      skip: (req) => skipWhenDisabled(req),
      handler: createHandler('password_reset_finish', finishWindowMs),
    })
  : (_req, _res, next) => next();

export default {
  passwordResetStartEmailRateLimiter,
  passwordResetStartIpRateLimiter,
  passwordResetFinishRateLimiter,
};
