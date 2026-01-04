import { v4 as uuidv4 } from 'uuid';

// Lightweight request ID middleware: assigns an ID and exposes header
export default function requestId(req, res, next) {
  const candidate =
    (
      req.get?.('X-Request-Id') ||
      req.get?.('X-Correlation-Id') ||
      ''
    ).trim?.() || '';
  const id =
    candidate && candidate.length <= 128 && /^[A-Za-z0-9._-]+$/.test(candidate)
      ? candidate
      : uuidv4();
  req.id = id;
  res.locals.requestId = id;
  res.set('X-Request-Id', id);
  next();
}
