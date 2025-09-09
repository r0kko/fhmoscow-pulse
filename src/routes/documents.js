import express from 'express';
import multer from 'multer';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/documentAdminController.js';
import contractsController from '../controllers/documentContractAdminController.js';
import documentController from '../controllers/documentController.js';
import {
  createDocumentValidator,
  updateDocumentValidator,
} from '../validators/documentValidators.js';
import validate from '../middlewares/validate.js';
import { uuidParam } from '../validators/paramsValidators.js';

const upload = multer();

const router = express.Router();

router.get(
  '/consent/:id',
  auth,
  authorize('ADMIN'),
  controller.downloadConsent
);

router.get('/admin', auth, authorize('ADMIN'), controller.list);

// Admin: Contracting tab — list eligible judges
router.get(
  '/admin/contracts/judges',
  auth,
  authorize('ADMIN'),
  contractsController.listJudges
);

router.get(
  '/admin/contracts/judges/:id/precheck',
  auth,
  authorize('ADMIN'),
  ...uuidParam('id'),
  validate,
  contractsController.precheck
);

router.post(
  '/admin/contracts/judges/:id/application',
  auth,
  authorize('ADMIN'),
  ...uuidParam('id'),
  validate,
  contractsController.generateApplication
);

router.get('/', auth, documentController.list);
router.post(
  '/',
  auth,
  authorize('ADMIN'),
  upload.single('file'),
  createDocumentValidator,
  validate,
  documentController.create
);
// User: request a signing code for a specific document
router.post(
  '/:id/send-code',
  auth,
  ...uuidParam('id'),
  validate,
  documentController.sendCode
);
// User: sign a specific document with a 6-digit code
router.post(
  '/:id/sign',
  auth,
  ...uuidParam('id'),
  validate,
  documentController.sign
);
router.post(
  '/:id/request-sign',
  auth,
  authorize('ADMIN'),
  controller.requestSignature
);

router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  updateDocumentValidator,
  validate,
  documentController.update
);

router.delete('/:id', auth, authorize('ADMIN'), documentController.remove);

router.post('/:id/regenerate', auth, authorize('ADMIN'), controller.regenerate);

router.post(
  '/:id/file',
  auth,
  authorize('ADMIN'),
  upload.single('file'),
  controller.uploadSigned
);

export default router;
