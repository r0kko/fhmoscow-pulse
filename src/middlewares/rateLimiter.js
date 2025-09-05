import rateLimit from 'express-rate-limit';

function clientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    // Express respects trust proxy for req.ip; this is a fallback
    req.ip ||
    req.connection?.remoteAddress ||
    ''
  ).toString();
}

/**
 * Global rate limiter middleware to mitigate denial-of-service attacks.
 * Defaults to 100 requests per 15 minute window unless overridden by env vars.
 */
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000');
const max = parseInt(process.env.RATE_LIMIT_MAX || '100');

export default rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  skip: (req) => {
    // Do not rate-limit health and CSRF token endpoints
    const p = req.path || '';
    return (
      p === '/health' || p === '/ready' || p === '/live' || p === '/csrf-token'
    );
  },
});
