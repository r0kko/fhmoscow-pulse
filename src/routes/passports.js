import express from 'express';

import auth from '../middlewares/auth.js';
import passportController from '../controllers/passportController.js';

const router = express.Router();

router.get('/me', auth, passportController.me);

export default router;
