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

// Conservative per-IP limiter for login endpoint
const windowMs = parseInt(process.env.LOGIN_RATE_WINDOW_MS || '60000'); // 1 min
const max = parseInt(process.env.LOGIN_RATE_MAX || '10');

export default rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
});
