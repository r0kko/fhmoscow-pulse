import { isApiDocsRequestAllowed, isDocsEnabled } from '../config/docs.js';

export default function apiDocsGuard(req, res, next) {
  if (!isDocsEnabled()) {
    return res.status(404).json({ error: 'not_found' });
  }

  if (!isApiDocsRequestAllowed(req)) {
    return res.status(404).json({ error: 'not_found' });
  }

  return next();
}
