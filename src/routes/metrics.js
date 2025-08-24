import express from 'express';

import { metricsText } from '../config/metrics.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const text = await metricsText();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(text);
  } catch (err) {
    res.status(500).send(`# metrics error: ${err.message}\n`);
  }
});

export default router;
