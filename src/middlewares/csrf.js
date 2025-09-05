import csrf from '../config/csrf.js';

const EXEMPT_PATHS = ['/csrf-token'];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export default function csrfMiddleware(req, res, next) {
  // Skip CSRF for safe methods and explicitly exempted paths
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.includes(req.path)) {
    return next();
  }
  // Enforce CSRF for state-changing requests only
  return csrf(req, res, next);
}
