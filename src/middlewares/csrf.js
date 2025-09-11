import csrf from '../config/csrf.js';
import { verifyCsrfHmac } from '../utils/csrfHmac.js';
import { incCsrfAccepted, incCsrfRejected } from '../config/metrics.js';

// Keep CSRF disabled for token fetch and refresh endpoints only.
// Do NOT exempt /auth/login: tests and policy require CSRF on login.
const EXEMPT_PATHS = ['/csrf-token', '/auth/refresh'];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export default function csrfMiddleware(req, res, next) {
  // Skip CSRF for safe methods and explicitly exempted paths
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.includes(req.path)) {
    try {
      incCsrfAccepted('skipped_safe');
    } catch (_) {
      /* noop */ void 0;
    }
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
    } catch (_) {
      /* noop */ void 0;
    }
    return next();
  }
  // If client provides a valid stateless, HMAC-signed token in header, accept it.
  // This avoids reliance on third-party cookies (Safari/ITP, some corporate browsers).
  try {
    const headerToken =
      req.get('X-XSRF-TOKEN') ||
      req.get('x-xsrf-token') ||
      req.get('X-CSRF-TOKEN') ||
      req.get('x-csrf-token') ||
      req.get('X-CSRFToken') ||
      req.get('x-csrftoken');
    if (headerToken && verifyCsrfHmac(headerToken, req)) {
      incCsrfAccepted('hmac');
      return next();
    }
    // Legacy double-submit cookie support: accept if header equals either
    // XSRF cookie variant set previously by the app or older clients.
    const c1 = req.cookies?.['XSRF-TOKEN-API'];
    const c2 = req.cookies?.['XSRF-TOKEN'];
    if (headerToken && (headerToken === c1 || headerToken === c2)) {
      incCsrfAccepted('double_submit_legacy');
      return next();
    }
  } catch (_e) {
    // fall back to cookie-based enforcement below
    try {
      incCsrfRejected('hmac_error');
    } catch (_) {
      /* noop */ void 0;
    }
  }
  // Enforce CSRF for state-changing requests only
  return csrf(req, res, (err) => {
    if (err) {
      try {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('ebadcsrftoken'))
          incCsrfRejected('cookie_missing_or_mismatch');
        else incCsrfRejected('other');
      } catch (_) {
        /* noop */ void 0;
      }
    }
    return next(err);
  });
}
