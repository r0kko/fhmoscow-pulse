import csrf from '../config/csrf.js';

export default function csrfMiddleware(req, res, next) {
  if (req.path === '/csrf-token') {
    return next();
  }
  return csrf(req, res, next);
}
