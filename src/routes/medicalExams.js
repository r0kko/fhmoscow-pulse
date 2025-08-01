import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/medicalExamAdminController.js';
import selfController from '../controllers/medicalExamSelfController.js';
import registrationsController from '../controllers/medicalExamRegistrationAdminController.js';
import {
  medicalExamCreateRules,
  medicalExamUpdateRules,
} from '../validators/medicalExamValidators.js';
import { updateRegistrationRules } from '../validators/medicalExamRegistrationValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.get('/available', auth, authorize('REFEREE'), selfController.available);
router.get('/me/upcoming', auth, authorize('REFEREE'), selfController.upcoming);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  medicalExamCreateRules,
  controller.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  medicalExamUpdateRules,
  controller.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

router.get(
  '/:id/registrations',
  auth,
  authorize('ADMIN'),
  registrationsController.list
);
router.get(
  '/:id/registrations/export',
  auth,
  authorize('ADMIN'),
  registrationsController.exportPdf
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

export default router;
