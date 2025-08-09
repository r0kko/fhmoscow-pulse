import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/documentAdminController.js';
import documentController from '../controllers/documentController.js';
import { createDocumentValidator } from '../validators/documentValidators.js';

const router = express.Router();

router.get(
  '/consent/:id',
  auth,
  authorize('ADMIN'),
  controller.downloadConsent
);

router.get('/admin', auth, authorize('ADMIN'), controller.list);

router.get('/', auth, documentController.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  createDocumentValidator,
  documentController.create
);
router.post('/:id/sign', auth, documentController.sign);

export default router;
