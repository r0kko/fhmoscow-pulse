import express from 'express';

import { incShortLinkResolve } from '../config/metrics.js';
import { shortLinkRateLimiter } from '../middlewares/verifyRateLimiter.js';
import { resolveCode } from '../services/shortLinkService.js';

const router = express.Router();

function basePath() {
  return (process.env.BASE_URL || '').replace(/\/+$/, '');
}

function verifyPath(reason = '') {
  const base = basePath();
  const path = `${base}/verify`.replace(/([^:]\/)\/+/g, '$1');
  if (!reason) return path;
  return `${path}#reason=${encodeURIComponent(reason)}`;
}

function verifyTokenPath(token) {
  const base = basePath();
  const path = `${base}/verify`.replace(/([^:]\/)\/+/g, '$1');
  return `${path}#t=${encodeURIComponent(token)}`;
}

function prefersJson(req) {
  const accept = String(req.get('accept') || '').toLowerCase();
  if (!accept) return false;
  if (accept.includes('text/html')) return false;
  return accept.includes('application/json') || accept.includes('*/*');
}

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
}

// Public resolver for QR short URLs: /v/:code → 302 Location: /verify#t=...
router.get('/:code', shortLinkRateLimiter, async (req, res) => {
  noStore(res);

  const code = String(req.params.code || '').trim();
  if (!code || !/^[0-9a-zA-Z]{6,32}$/.test(code)) {
    incShortLinkResolve('invalid_code');
    if (prefersJson(req))
      return res.status(400).json({ error: 'invalid_code' });
    return res.redirect(302, verifyPath('invalid_code'));
  }

  const token = await resolveCode(code);
  if (!token) {
    incShortLinkResolve('not_found');
    if (prefersJson(req)) return res.status(404).json({ error: 'not_found' });
    return res.redirect(302, verifyPath('not_found'));
  }

  incShortLinkResolve('ok');
  return res.redirect(302, verifyTokenPath(token));
});

export default router;
