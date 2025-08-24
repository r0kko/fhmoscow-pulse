import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/staffController.js';
import accessScope from '../middlewares/accessScope.js';

const router = express.Router();

// Initiate staff sync from external source
router.post('/sync', auth, authorize('ADMIN'), controller.sync);

export default router;
// List staff with filters (team, club, season, search)
router.get(
  '/',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.list
);
