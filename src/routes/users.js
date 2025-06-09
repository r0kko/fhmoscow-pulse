import express from 'express';

const router = express.Router();

/**
 * GET /users
 * Respond with a list of users.
 * At this stage we return an empty array placeholder.
 * res.locals.body is filled for requestLogger middleware to persist.
 */
router.get('/', async (req, res) => {
  const response = { users: [] }; // TODO: fetch from DB later
  res.locals.body = response;
  res.json(response);
});

export default router;
