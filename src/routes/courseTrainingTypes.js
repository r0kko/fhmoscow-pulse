import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import createController from '../controllers/trainingTypeAdminController.js';
import {
  trainingTypeCreateRules,
  trainingTypeUpdateRules,
} from '../validators/trainingTypeValidators.js';

const controller = createController(false);
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
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
