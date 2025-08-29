import express from 'express';

import innController from '../controllers/innController.js';
import { innRules } from '../validators/personalValidators.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';

const router = express.Router();

/**
 * @swagger
 * /inns/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user's INN
 *     responses:
 *       200:
 *         description: INN info
 */
router.get('/me', auth, innController.me);

/**
 * @swagger
 * /inns:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create INN record for current user
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', auth, innRules, validate, innController.create);

export default router;
