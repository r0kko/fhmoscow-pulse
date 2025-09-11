import express from 'express';

import { resolveCode } from '../services/shortLinkService.js';

const router = express.Router();

// Public resolver for QR short URLs: /v/:code → 302 Location: /verify?t=...
router.get('/:code', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const code = String(req.params.code || '').trim();
  if (!code || !/^[0-9a-zA-Z]{6,32}$/.test(code))
    return res.status(400).json({ error: 'invalid_code' });
  const token = await resolveCode(code);
  if (!token) return res.status(404).json({ error: 'not_found' });
  const base = (process.env.BASE_URL || '').replace(/\/+$/, '');
  const location = `${base}/verify?t=${encodeURIComponent(token)}`;
  // Redirect browser to the SPA route which will call the API /verify
  return res.redirect(302, location);
});

export default router;
