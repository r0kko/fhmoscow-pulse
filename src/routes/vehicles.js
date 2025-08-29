import express from 'express';

import auth from '../middlewares/auth.js';
import denyStaffOnly from '../middlewares/denyStaffOnly.js';
import controller from '../controllers/vehicleController.js';
import {
  vehicleCreateRules,
  vehicleUpdateRules,
} from '../validators/vehicleValidators.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

router.get('/me', auth, denyStaffOnly, controller.me);
router.post(
  '/',
  auth,
  denyStaffOnly,
  vehicleCreateRules,
  validate,
  controller.create
);
router.patch(
  '/:id',
  auth,
  denyStaffOnly,
  vehicleUpdateRules,
  validate,
  controller.update
);
router.delete('/:id', auth, denyStaffOnly, controller.remove);

export default router;
