import express from 'express';

import auth from '../middlewares/auth.js';
import bankAccountController from '../controllers/bankAccountController.js';

const router = express.Router();

router.get('/me', auth, bankAccountController.me);

export default router;
