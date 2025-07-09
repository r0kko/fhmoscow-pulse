import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/documentAdminController.js';

const router = express.Router();

router.get('/consent/:id', auth, authorize('ADMIN'), controller.downloadConsent);

export default router;
