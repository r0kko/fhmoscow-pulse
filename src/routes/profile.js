import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/profileCompletionController.js';

const router = express.Router();

router.post('/complete', auth, controller.complete);

export default router;
