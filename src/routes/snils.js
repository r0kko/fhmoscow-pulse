import express from 'express';
import { body } from 'express-validator';

import auth from '../middlewares/auth.js';
import snilsController from '../controllers/snilsController.js';

const router = express.Router();

router.get('/me', auth, snilsController.me);
router.post(
  '/',
  auth,
  body('number').isString().notEmpty(),
  snilsController.create
);

export default router;
