import express from 'express';

import innController from '../controllers/innController.js';
import { innRules } from '../validators/personalValidators.js';

const router = express.Router();

router.get('/me', auth, innController.me);
router.post('/', auth, innRules, innController.create);

export default router;
