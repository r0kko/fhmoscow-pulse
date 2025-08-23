import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/playerController.js';

const router = express.Router();

router.get(
  '/',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  controller.list
);
router.post('/sync', auth, authorize('ADMIN'), controller.sync);

export default router;
