import express from 'express';

import auth from '../middlewares/auth.js';
import innController from '../controllers/innController.js';
import { body } from 'express-validator';

const router = express.Router();

router.get('/me', auth, innController.me);
router.post('/', auth, body('number').isString().notEmpty(), innController.create);

export default router;
