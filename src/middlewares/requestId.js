import { v4 as uuidv4 } from 'uuid';

// Lightweight request ID middleware: assigns an ID and exposes header
export default function requestId(req, res, next) {
  const id = uuidv4();
  req.id = id;
  res.locals.requestId = id;
  res.set('X-Request-Id', id);
  next();
}
