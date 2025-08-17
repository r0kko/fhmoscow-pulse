import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/userTeamController.js';
import { addTeamRules } from '../validators/userTeamValidators.js';

const router = express.Router();

router.get('/', auth, authorize('SPORT_SCHOOL_STAFF'), controller.list);
router.post(
  '/',
  auth,
  authorize('SPORT_SCHOOL_STAFF'),
  addTeamRules,
  controller.add
);
router.delete(
  '/:teamId',
  auth,
  authorize('SPORT_SCHOOL_STAFF'),
  controller.remove
);

export default router;
