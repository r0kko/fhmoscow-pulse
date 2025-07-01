import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/campStadiumAdminController.js';
import {
  campStadiumCreateRules,
  campStadiumUpdateRules,
} from '../validators/campStadiumValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.get('/parking-types', auth, authorize('ADMIN'), controller.parkingTypes);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  campStadiumCreateRules,
  controller.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  campStadiumUpdateRules,
  controller.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
