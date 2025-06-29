import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/profileCompletionController.js';

const router = express.Router();

/**
 * @swagger
 * /profile/complete:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Mark profile as complete
 *     responses:
 *       200:
 *         description: Profile completed
 */
router.post('/complete', auth, controller.complete);

/**
 * @swagger
 * /profile/progress:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Set profile completion step
 *     responses:
 *       200:
 *         description: Step updated
 */
router.post('/progress', auth, controller.setStep);

export default router;
