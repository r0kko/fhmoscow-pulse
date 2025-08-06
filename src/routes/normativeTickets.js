import express from 'express';
import multer from 'multer';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import selfController from '../controllers/normativeTicketSelfController.js';
import adminController from '../controllers/normativeTicketAdminController.js';
import { normativeTicketCreateRules } from '../validators/normativeTicketValidators.js';
import { MAX_NORMATIVE_FILE_SIZE } from '../config/fileLimits.js';

const router = express.Router();
const upload = multer({ limits: { fileSize: MAX_NORMATIVE_FILE_SIZE } });

router.post(
  '/',
  auth,
  authorize('REFEREE'),
  upload.single('file'),
  normativeTicketCreateRules,
  selfController.create
);

router.post('/:id/approve', auth, authorize('ADMIN'), adminController.approve);

router.post('/:id/reject', auth, authorize('ADMIN'), adminController.reject);

export default router;
