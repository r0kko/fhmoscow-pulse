export function sendError(res, err, defaultStatus = 400) {
  const status = err?.status || defaultStatus;
  const code = err?.code || err?.message || 'internal_error';
  return res.status(status).json({ error: code });
}
