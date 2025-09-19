import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import validate from '../middlewares/validate.js';
import controller from '../controllers/playerPhotoRequestAdminController.js';
import {
  listPlayerPhotoRequestsRules,
  rejectPlayerPhotoRequestRules,
} from '../validators/playerPhotoRequestValidators.js';

const router = express.Router();

router.get(
  '/',
  auth,
  authorize('ADMIN'),
  listPlayerPhotoRequestsRules,
  validate,
  controller.list
);

router.get('/:id', auth, authorize('ADMIN'), controller.show);

router.post('/:id/approve', auth, authorize('ADMIN'), controller.approve);

router.post(
  '/:id/reject',
  auth,
  authorize('ADMIN'),
  rejectPlayerPhotoRequestRules,
  validate,
  controller.reject
);

export default router;
