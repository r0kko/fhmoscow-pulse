import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/trainingAdminController.js';
import selfController from '../controllers/trainingSelfController.js';
import registrationsController from '../controllers/trainingRegistrationAdminController.js';
import {
  trainingCreateRules,
  trainingUpdateRules,
} from '../validators/trainingValidators.js';
import {
  createRegistrationRules,
  updateRegistrationRules,
} from '../validators/trainingRegistrationValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  trainingCreateRules,
  controller.create
);
router.get('/available', auth, selfController.available);
router.get('/me/upcoming', auth, selfController.upcoming);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  trainingUpdateRules,
  controller.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

router.get(
  '/:id/registrations',
  auth,
  authorize('ADMIN'),
  registrationsController.list
);
router.post(
  '/:id/registrations',
  auth,
  authorize('ADMIN'),
  createRegistrationRules,
  registrationsController.create
);
router.put(
  '/:id/registrations/:userId',
  auth,
  authorize('ADMIN'),
  updateRegistrationRules,
  registrationsController.update
);
router.delete(
  '/:id/registrations/:userId',
  auth,
  authorize('ADMIN'),
  registrationsController.remove
);

router.post('/:id/register', auth, selfController.register);
router.delete('/:id/register', auth, selfController.unregister);

export default router;
