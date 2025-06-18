import express from 'express';

import auth from '../middlewares/auth.js';

import authRouter from './auth.js';
import usersRouter from './users.js';
import emailRouter from './email.js';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/email', emailRouter);

/**
 * @swagger
 * /csrf-token:
 *   get:
 *     summary: Retrieve CSRF token
 *     responses:
 *       200:
 *         description: Returns a CSRF token
 */
router.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

/**
 * @swagger
 * /:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user information
 *     responses:
 *       200:
 *         description: Returns authenticated user info
 */
router.get('/', auth, (req, res) => {
  const response = { user: req.user };
  res.locals.body = response;
  res.json(response);
});

export default router;
