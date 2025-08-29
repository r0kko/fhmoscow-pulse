import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import createAdminController from '../controllers/trainingAdminController.js';
import createSelfController from '../controllers/trainingSelfController.js';
import createRegistrationsController from '../controllers/trainingRegistrationAdminController.js';
import {
  trainingCreateRules,
  trainingUpdateRules,
  updateAttendanceRules,
} from '../validators/trainingValidators.js';
import {
  createRegistrationRules,
  updateRegistrationRules,
  updatePresenceRules,
} from '../validators/trainingRegistrationValidators.js';
import validate from '../middlewares/validate.js';

const controller = createAdminController(false);
const selfController = createSelfController(false);
const registrationsController = createRegistrationsController(false);
const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.get('/upcoming', auth, authorize('ADMIN'), controller.upcoming);
router.get('/past', auth, authorize('ADMIN'), controller.past);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  trainingCreateRules,
  validate,
  controller.create
);
router.get('/available', auth, authorize('REFEREE'), selfController.available);
router.get('/me/upcoming', auth, authorize('REFEREE'), selfController.upcoming);
router.get('/me/past', auth, authorize('REFEREE'), selfController.past);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  trainingUpdateRules,
  validate,
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
  validate,
  registrationsController.create
);
router.put(
  '/:id/registrations/:userId',
  auth,
  authorize('ADMIN'),
  updateRegistrationRules,
  validate,
  registrationsController.update
);
router.put(
  '/:id/registrations/:userId/presence',
  auth,
  updatePresenceRules,
  validate,
  registrationsController.updatePresence
);
router.get('/:id/attendance', auth, registrationsController.listForAttendance);
router.put(
  '/:id/attendance',
  auth,
  updateAttendanceRules,
  validate,
  controller.setAttendance
);
router.delete(
  '/:id/registrations/:userId',
  auth,
  authorize('ADMIN'),
  registrationsController.remove
);

router.post(
  '/:id/register',
  auth,
  authorize('REFEREE'),
  selfController.register
);
router.delete(
  '/:id/register',
  auth,
  authorize('REFEREE'),
  selfController.unregister
);

router.get(
  '/users/:userId/history',
  auth,
  authorize('ADMIN'),
  registrationsController.history
);

export default router;
