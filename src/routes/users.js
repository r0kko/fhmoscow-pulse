import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     responses:
 *       200:
 *         description: Array of users
 */
router.get('/', async (req, res) => {
  const response = { users: [] }; // TODO: fetch from DB later
  res.locals.body = response;
  res.json(response);
});

export default router;
