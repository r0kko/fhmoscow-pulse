import express from 'express';

import { innRules } from '../validators/personalValidators.js';
import auth from '../middlewares/auth.js';
import innController from '../controllers/innController.js';

const router = express.Router();

router.get('/me', auth, innController.me);
router.post('/', auth, innRules, innController.create);

export default router;
