import express from 'express';

import { metricsText } from '../config/metrics.js';

const router = express.Router();

function basicAuthOk(req) {
  const user = process.env.METRICS_USER;
  const pass = process.env.METRICS_PASS;
  // In production, require credentials to be set explicitly
  if (process.env.NODE_ENV === 'production' && (!user || !pass)) {
    return false;
  }
  // In non-production, allow open metrics if creds not provided
  if (!user && !pass) return true;
  const hdr = req.headers['authorization'] || '';
  if (!hdr.startsWith('Basic ')) return false;
  const token = hdr.slice(6);
  try {
    const [u, p] = Buffer.from(token, 'base64').toString('utf8').split(':');
    return u === user && p === pass;
  } catch {
    return false;
  }
}

router.get('/', async (req, res) => {
  if (!basicAuthOk(req)) {
    res.set('WWW-Authenticate', 'Basic realm="metrics"');
    return res.status(401).send('Unauthorized');
  }
  try {
    const text = await metricsText();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(text);
  } catch (err) {
    res.status(500).send(`# metrics error: ${err.message}\n`);
  }
});

export default router;
