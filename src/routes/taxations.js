import express from 'express';

import auth from '../middlewares/auth.js';
import taxationController from '../controllers/taxationController.js';

const router = express.Router();

router.get('/me', auth, taxationController.me);
router.post('/me/check', auth, taxationController.check);
router.post('/me', auth, taxationController.update);

export default router;
