import express from 'express';

import snilsController from '../controllers/snilsController.js';
import { snilsRules } from '../validators/personalValidators.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

router.get('/me', auth, snilsController.me);
router.post('/', auth, snilsRules, snilsController.create);

export default router;
