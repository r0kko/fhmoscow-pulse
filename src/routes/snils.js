import express from 'express';

import snilsController from '../controllers/snilsController.js';
import { snilsRules } from '../validators/personalValidators.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /snils/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user's SNILS
 *     responses:
 *       200:
 *         description: SNILS info
 */
router.get('/me', auth, snilsController.me);

/**
 * @swagger
 * /snils:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create SNILS record for current user
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', auth, snilsRules, snilsController.create);

export default router;
