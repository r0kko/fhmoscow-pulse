import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/trainingTypeAdminController.js';
import {
  trainingTypeCreateRules,
  trainingTypeUpdateRules,
} from '../validators/trainingTypeValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  trainingTypeCreateRules,
  controller.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  trainingTypeUpdateRules,
  controller.update
);


export default router;
