import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/refereeGroupAdminController.js';
import {
  refereeGroupCreateRules,
  refereeGroupUpdateRules,
} from '../validators/refereeGroupValidators.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  refereeGroupCreateRules,
  validate,
  controller.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  refereeGroupUpdateRules,
  validate,
  controller.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
