import { validationResult } from 'express-validator';

function toCode(msg) {
  if (typeof msg === 'string' && /^[a-z0-9_]+$/i.test(msg)) {
    return msg.toLowerCase();
  }
  const s = String(msg || 'invalid_value')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  return s || 'invalid_value';
}

function normalize(details) {
  return details.map((e) => ({
    field: e.path || e.param || 'unknown',
    code: toCode(e.msg),
  }));
}

export default function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const items = result.array({ onlyFirstError: true });
  const details = normalize(items);

  // Preserve legacy simple error for known single-code cases
  if (details.length === 1 && details[0].code === 'weak_password') {
    return res.status(400).json({ error: 'weak_password' });
  }

  return res.status(400).json({ error: 'validation_error', details });
}
