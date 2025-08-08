import rateLimit from 'express-rate-limit';

// Conservative per-IP limiter for login endpoint
const windowMs = parseInt(process.env.LOGIN_RATE_WINDOW_MS || '60000'); // 1 min
const max = parseInt(process.env.LOGIN_RATE_MAX || '10');

export default rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
});
