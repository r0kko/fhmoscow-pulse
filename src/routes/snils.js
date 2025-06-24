import express from 'express';

import auth from '../middlewares/auth.js';
import snilsController from '../controllers/snilsController.js';

const router = express.Router();

router.get('/me', auth, snilsController.me);

export default router;
