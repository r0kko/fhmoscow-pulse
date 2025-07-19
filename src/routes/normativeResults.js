import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/normativeResultAdminController.js';
import selfController from '../controllers/normativeResultSelfController.js';
import {
  normativeResultCreateRules,
  normativeResultUpdateRules,
  normativeResultSelfCreateRules,
  normativeResultSelfUpdateRules,
} from '../validators/normativeResultValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.get('/me', auth, authorize('REFEREE'), selfController.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  normativeResultCreateRules,
  controller.create
);
router.post(
  '/me',
  auth,
  authorize('REFEREE'),
  normativeResultSelfCreateRules,
  selfController.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.get('/me/:id', auth, authorize('REFEREE'), selfController.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  normativeResultUpdateRules,
  controller.update
);
router.put(
  '/me/:id',
  auth,
  authorize('REFEREE'),
  normativeResultSelfUpdateRules,
  selfController.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);
router.delete('/me/:id', auth, authorize('REFEREE'), selfController.remove);

export default router;
