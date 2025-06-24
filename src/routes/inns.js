import express from 'express';
import { body } from 'express-validator';

import auth from '../middlewares/auth.js';
import innController from '../controllers/innController.js';

const router = express.Router();

router.get('/me', auth, innController.me);
router.post(
  '/',
  auth,
  body('number').isString().notEmpty(),
  innController.create
);

export default router;
