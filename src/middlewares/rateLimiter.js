import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter middleware to mitigate denial-of-service attacks.
 * Limits each IP to 100 requests per 15 minute window.
 */
export default rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
