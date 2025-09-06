import { incHttpErrorCode } from '../config/metrics.js';

export function sendError(res, err, defaultStatus = 400) {
  const status = err?.status || defaultStatus;
  let code;
  if (err?.code) {
    code = err.code;
  } else if (status >= 500) {
    // Не раскрываем внутренние детали для 5xx
    code = 'internal_error';
  } else {
    code = err?.message || 'internal_error';
  }
  try {
    // Surface error code as response header for logs/drilldown
    res.set('X-Error-Code', String(code));
    // Increment error code metric for global monitoring
    incHttpErrorCode(String(code), Number(status));
  } catch (_) {
    /* ignore */
  }
  if (err?.retryAfter) {
    // Seconds per RFC for Retry-After
    const secs = Math.max(1, Math.ceil(Number(err.retryAfter)));
    res.set('Retry-After', String(secs));
  }
  return res.status(status).json({ error: code });
}
