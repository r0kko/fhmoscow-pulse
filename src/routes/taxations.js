import express from 'express';

import auth from '../middlewares/auth.js';
import taxationController from '../controllers/taxationController.js';

const router = express.Router();

router.get('/me', auth, taxationController.me);

export default router;
