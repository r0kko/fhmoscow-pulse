import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/matchController.js';

const router = express.Router();

router.get(
  '/upcoming',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  controller.listUpcoming
);

export default router;
