import rateLimit from 'express-rate-limit';

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
});
