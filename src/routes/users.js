import express from 'express';

import auth from '../middlewares/auth.js';
import userMapper from '../mappers/userMapper.js';

const router = express.Router();

/**
 * @swagger
 * /users/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user data
 *     responses:
 *       200:
 *         description: Current user info
 */
router.get('/me', auth, (req, res) => {
  const response = { user: userMapper.toPublic(req.user) };
  res.locals.body = response;
  res.json(response);
});

export default router;
