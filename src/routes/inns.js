import express from 'express';

import auth from '../middlewares/auth.js';
import innController from '../controllers/innController.js';

const router = express.Router();

router.get('/me', auth, innController.me);

export default router;
