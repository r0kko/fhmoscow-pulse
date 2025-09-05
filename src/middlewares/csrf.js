import csrf from '../config/csrf.js';
import { verifyCsrfHmac } from '../utils/csrfHmac.js';
import { incCsrfAccepted, incCsrfRejected } from '../config/metrics.js';

const EXEMPT_PATHS = ['/csrf-token', '/auth/refresh'];
if (String(process.env.CSRF_EXEMPT_LOGIN || '').toLowerCase() === 'true') {
  EXEMPT_PATHS.push('/auth/login');
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export default function csrfMiddleware(req, res, next) {
  // Skip CSRF for safe methods and explicitly exempted paths
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.includes(req.path)) {
    try {
      incCsrfAccepted('skipped_safe');
    } catch (_) {}
    return next();
  }
  // If request carries a Bearer token, treat it as API-style auth and skip CSRF
  // Best practice: CSRF protects cookie-based auth; Bearer headers are not subject to CSRF.
  if (
    typeof req.headers?.authorization === 'string' &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    try {
      incCsrfAccepted('skipped_bearer');
    } catch (_) {}
    return next();
  }
  // If client provides a valid stateless, HMAC-signed token in header, accept it.
  // This avoids reliance on third-party cookies (Safari/ITP, some corporate browsers).
  try {
    const headerToken = req.get('X-XSRF-TOKEN') || req.get('x-xsrf-token');
    if (headerToken && verifyCsrfHmac(headerToken, req)) {
      incCsrfAccepted('hmac');
      return next();
    }
  } catch (_e) {
    // fall back to cookie-based enforcement below
    try {
      incCsrfRejected('hmac_error');
    } catch (_) {}
  }
  // Enforce CSRF for state-changing requests only
  return csrf(req, res, (err) => {
    if (err) {
      try {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('ebadcsrftoken')) incCsrfRejected('cookie_missing_or_mismatch');
        else incCsrfRejected('other');
      } catch (_) {}
    }
    return next(err);
  });
}
