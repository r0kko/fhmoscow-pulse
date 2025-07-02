import express from 'express';
import multer from 'multer';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import medicalCertificateController from '../controllers/medicalCertificateController.js';
import selfController from '../controllers/medicalCertificateSelfController.js';
import adminController from '../controllers/medicalCertificateAdminController.js';
import fileController from '../controllers/medicalCertificateFileController.js';
import { medicalCertificateRules } from '../validators/medicalCertificateValidators.js';

const upload = multer();

const router = express.Router();

router.get('/me', auth, medicalCertificateController.me);
router.get('/me/history', auth, medicalCertificateController.history);
router.post('/', auth, medicalCertificateRules, selfController.create);
router.delete('/', auth, selfController.remove);
router.get('/me/files', auth, fileController.listMe);

router.get('/role/:alias', auth, authorize('ADMIN'), adminController.listByRole);

router.get('/', auth, authorize('ADMIN'), adminController.list);
router.get('/:id', auth, authorize('ADMIN'), adminController.get);
router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  medicalCertificateRules,
  adminController.updateById
);
router.delete('/:id', auth, authorize('ADMIN'), adminController.remove);
router.post(
  '/:id/files',
  auth,
  authorize('ADMIN'),
  upload.single('file'),
  fileController.upload
);
router.get('/:id/files', auth, fileController.list);
router.delete(
  '/:id/files/:fileId',
  auth,
  authorize('ADMIN'),
  fileController.remove
);

export default router;
