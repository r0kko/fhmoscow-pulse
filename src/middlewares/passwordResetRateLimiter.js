import rateLimit from 'express-rate-limit';

const windowMs = parseInt(
  process.env.PASSWORD_RESET_RATE_WINDOW_MS || '3600000'
);
const max = parseInt(process.env.PASSWORD_RESET_RATE_MAX || '5');

export default rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
});
