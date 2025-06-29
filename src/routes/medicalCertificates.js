import express from 'express';

import auth from '../middlewares/auth.js';
import medicalCertificateController from '../controllers/medicalCertificateController.js';
import selfController from '../controllers/medicalCertificateSelfController.js';
import { medicalCertificateRules } from '../validators/medicalCertificateValidators.js';

const router = express.Router();

router.get('/me', auth, medicalCertificateController.me);
router.post('/', auth, medicalCertificateRules, selfController.create);
router.delete('/', auth, selfController.remove);

export default router;
