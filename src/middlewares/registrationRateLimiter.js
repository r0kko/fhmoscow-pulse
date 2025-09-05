import rateLimit from 'express-rate-limit';

function clientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress ||
    ''
  ).toString();
}

/**
 * Rate limiter for registration endpoints.
 * Defaults to 5 requests per hour unless overridden by env vars.
 */
const windowMs = parseInt(process.env.REGISTRATION_RATE_WINDOW_MS || '3600000');
const max = parseInt(process.env.REGISTRATION_RATE_MAX || '5');

export default rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
});
