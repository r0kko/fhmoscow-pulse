import express from 'express';
import multer from 'multer';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/documentAdminController.js';
import documentController from '../controllers/documentController.js';
import {
  createDocumentValidator,
  updateDocumentValidator,
} from '../validators/documentValidators.js';

const upload = multer();

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
  upload.single('file'),
  createDocumentValidator,
  documentController.create
);
router.post('/:id/sign', auth, documentController.sign);
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
