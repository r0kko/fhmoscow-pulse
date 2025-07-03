import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/refereeGroupAdminController.js';
import {
  refereeGroupCreateRules,
  refereeGroupUpdateRules,
} from '../validators/refereeGroupValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  refereeGroupCreateRules,
  controller.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  refereeGroupUpdateRules,
  controller.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
