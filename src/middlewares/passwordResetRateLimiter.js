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

const windowMs = parseInt(
  process.env.PASSWORD_RESET_RATE_WINDOW_MS || '3600000'
);
const max = parseInt(process.env.PASSWORD_RESET_RATE_MAX || '5');

export default rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
});
