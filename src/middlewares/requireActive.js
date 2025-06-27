export default async function requireActive(req, res, next) {
  const status = await req.user.getUserStatus();
  if (!status) return res.status(403).json({ error: 'status_unknown' });

  const alias = status.alias;
  if (alias === 'ACTIVE') return next();

  if (alias.startsWith('REGISTRATION_STEP_')) {
    const step = parseInt(alias.split('_').pop(), 10);
    return res.status(403).json({ error: 'registration_incomplete', step });
  }

  if (alias === 'AWAITING_CONFIRMATION') {
    return res.status(403).json({ error: 'awaiting_confirmation' });
  }

  if (alias === 'EMAIL_UNCONFIRMED') {
    return res.status(403).json({ error: 'email_unconfirmed' });
  }

  return res.status(403).json({ error: 'access_denied' });
}
