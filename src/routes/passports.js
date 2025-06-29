import express from 'express';

import auth from '../middlewares/auth.js';
import passportController from '../controllers/passportController.js';
import selfController from '../controllers/passportSelfController.js';
import { createPassportRules } from '../validators/passportValidators.js';

const router = express.Router();

/**
 * @swagger
 * /passports/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: Get current user's passport
 *     responses:
 *       200:
 *         description: Passport info
 */
router.get('/me', auth, passportController.me);

/**
 * @swagger
 * /passports:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create passport for current user
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', auth, createPassportRules, selfController.create);

/**
 * @swagger
 * /passports:
 *   delete:
 *     security:
 *       - bearerAuth: []
 *     summary: Delete current user's passport
 *     responses:
 *       204:
 *         description: Removed
 */
router.delete('/', auth, selfController.remove);

export default router;
