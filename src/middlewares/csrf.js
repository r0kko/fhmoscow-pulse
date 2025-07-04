import csrf from '../config/csrf.js';

const EXEMPT_PATHS = ['/csrf-token', '/auth/login', '/auth/logout', '/auth/refresh'];

export default function csrfMiddleware(req, res, next) {
  if (EXEMPT_PATHS.includes(req.path)) {
    return next();
  }
  return csrf(req, res, next);
}
