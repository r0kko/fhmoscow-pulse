import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import medicalCertificateController from '../controllers/medicalCertificateController.js';
import selfController from '../controllers/medicalCertificateSelfController.js';
import adminController from '../controllers/medicalCertificateAdminController.js';
import { medicalCertificateRules } from '../validators/medicalCertificateValidators.js';

const router = express.Router();

router.get('/me', auth, medicalCertificateController.me);
router.get('/me/history', auth, medicalCertificateController.history);
router.post('/', auth, medicalCertificateRules, selfController.create);
router.delete('/', auth, selfController.remove);

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

export default router;
