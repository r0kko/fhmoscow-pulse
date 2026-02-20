import { incHttpErrorCode } from '../config/metrics.js';

export function sendError(res, err, defaultStatus = 400) {
  const status = err?.status || defaultStatus;
  // Never leak raw exception messages to the API response.
  const code = err?.code ? String(err.code) : 'internal_error';
  try {
    // Surface error code as response header for logs/drilldown
    if (typeof res.set === 'function') {
      res.set('X-Error-Code', String(code));
    }
    // Increment error code metric for global monitoring
    incHttpErrorCode(String(code), Number(status));
  } catch (_) {
    /* ignore */
  }
  if (!res.locals) {
    res.locals = {};
  }
  const body = { error: code };
  if (code === 'internal_error' && typeof res.get === 'function') {
    const requestId = res.get('X-Request-Id');
    if (requestId) body.request_id = String(requestId);
  }
  if (err?.details !== undefined) body.details = err.details;
  if (err?.legacyCode !== undefined) body.legacy_code = err.legacyCode;
  res.locals.body = body;
  if (err?.retryAfter) {
    // Seconds per RFC for Retry-After
    const secs = Math.max(1, Math.ceil(Number(err.retryAfter)));
    if (typeof res.set === 'function') {
      res.set('Retry-After', String(secs));
    }
  }
  return res.status(status).json(body);
}
