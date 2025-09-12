import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/equipmentAdminController.js';
import validate from '../middlewares/validate.js';
import {
  equipmentCreateRules,
  equipmentUpdateRules,
} from '../validators/equipmentValidators.js';
import { equipmentAssignRules } from '../validators/equipmentValidators.js';

const router = express.Router();

// Dictionaries
router.get('/types', auth, authorize('ADMIN'), controller.listTypes);
router.get(
  '/manufacturers',
  auth,
  authorize('ADMIN'),
  controller.listManufacturers
);
router.get('/sizes', auth, authorize('ADMIN'), controller.listSizes);

// Items CRUD
router.get('/', auth, authorize('ADMIN'), controller.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  equipmentCreateRules,
  validate,
  controller.create
);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  equipmentUpdateRules,
  validate,
  controller.update
);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

// Assign to a user (issue)
router.post(
  '/:id/assign',
  auth,
  authorize('ADMIN'),
  equipmentAssignRules,
  validate,
  controller.assign
);

export default router;
