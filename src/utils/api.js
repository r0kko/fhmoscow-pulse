export function sendError(res, err, defaultStatus = 400) {
  const status = err?.status || defaultStatus;
  const code = err?.code || err?.message || 'internal_error';
  if (err?.retryAfter) {
    // Seconds per RFC for Retry-After
    const secs = Math.max(1, Math.ceil(Number(err.retryAfter)));
    res.set('Retry-After', String(secs));
  }
  return res.status(status).json({ error: code });
}
