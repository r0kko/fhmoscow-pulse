import csrf from '../config/csrf.js';

const EXEMPT_PATHS = ['/csrf-token', '/auth/refresh'];
if (String(process.env.CSRF_EXEMPT_LOGIN || '').toLowerCase() === 'true') {
  EXEMPT_PATHS.push('/auth/login');
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export default function csrfMiddleware(req, res, next) {
  // Skip CSRF for safe methods and explicitly exempted paths
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.includes(req.path)) {
    return next();
  }
  // If request carries a Bearer token, treat it as API-style auth and skip CSRF
  // Best practice: CSRF protects cookie-based auth; Bearer headers are not subject to CSRF.
  if (
    typeof req.headers?.authorization === 'string' &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    return next();
  }
  // Enforce CSRF for state-changing requests only
  return csrf(req, res, next);
}
