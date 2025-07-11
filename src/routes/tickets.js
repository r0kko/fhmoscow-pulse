import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import selfController from '../controllers/ticketSelfController.js';
import { createTicketRules } from '../validators/ticketValidators.js';

const router = express.Router();

/**
 * @swagger
 * /tickets/me:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List my tickets
 *     responses:
 *       200:
 *         description: Array of tickets
 */
router.get('/me', auth, authorize('REFEREE'), selfController.list);

/**
 * @swagger
 * /tickets:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create ticket
 *     responses:
 *       201:
 *         description: Created ticket
 */
router.post('/', auth, authorize('REFEREE'), createTicketRules, selfController.create);

export default router;
