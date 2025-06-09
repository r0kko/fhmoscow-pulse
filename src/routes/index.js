import express from 'express';

import auth from '../middlewares/auth.js';

import authRouter from './auth.js';

const router = express.Router();

router.use('/auth', authRouter);

/**
 * GET /
 * Example protected route.
 * Returns current user info if authorization succeeds.
 */
router.get('/', auth, (req, res) => {
  const response = { user: req.user };
  res.locals.body = response;
  res.json(response);
});

export default router;
