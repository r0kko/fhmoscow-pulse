import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/normativeGroupAdminController.js';
import {
  normativeGroupCreateRules,
  normativeGroupUpdateRules,
} from '../validators/normativeGroupValidators.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  normativeGroupCreateRules,
  validate,
  controller.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  normativeGroupUpdateRules,
  validate,
  controller.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
