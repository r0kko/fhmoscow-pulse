import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/addressController.js';
import selfController from '../controllers/addressSelfController.js';
import { addressRules } from '../validators/addressValidators.js';
import denyStaffOnly from '../middlewares/denyStaffOnly.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

router.get('/:type', auth, denyStaffOnly, controller.me);
router.post(
  '/:type',
  auth,
  denyStaffOnly,
  addressRules,
  validate,
  selfController.create
);
router.put(
  '/:type',
  auth,
  denyStaffOnly,
  addressRules,
  validate,
  selfController.update
);
router.delete('/:type', auth, denyStaffOnly, selfController.remove);

export default router;
