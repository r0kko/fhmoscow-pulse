import express from 'express';

import controller from '../controllers/registrationController.js';
import {
  startRegistrationRules,
  finishRegistrationRules,
} from '../validators/registrationValidators.js';
import registrationRateLimiter from '../middlewares/registrationRateLimiter.js';

const router = express.Router();

/**
 * @swagger
 * /register/start:
 *   post:
 *     summary: Begin user registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification code sent
 */
router.post(
    '/start',
    registrationRateLimiter,
    startRegistrationRules,
    controller.start
);

/**
 * @swagger
 * /register/finish:
 *   post:
 *     summary: Complete user registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registration completed
 */
router.post(
  '/finish',
  registrationRateLimiter,
  finishRegistrationRules,
  controller.finish
);

export default router;
