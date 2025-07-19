import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/normativeTypeAdminController.js';
import selfController from '../controllers/normativeTypeSelfController.js';
import {
  normativeTypeCreateRules,
  normativeTypeUpdateRules,
} from '../validators/normativeTypeValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.get('/available', auth, authorize('REFEREE'), selfController.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  normativeTypeCreateRules,
  controller.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  normativeTypeUpdateRules,
  controller.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
