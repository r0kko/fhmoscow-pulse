import express from 'express';
import multer from 'multer';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import selfController from '../controllers/ticketSelfController.js';
import fileController from '../controllers/ticketFileController.js';
import { createTicketRules } from '../validators/ticketValidators.js';

const router = express.Router();
const upload = multer();

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
router.post(
  '/',
  auth,
  authorize('REFEREE'),
  createTicketRules,
  selfController.create
);

router.post('/:id/files', auth, upload.single('file'), fileController.upload);
router.get('/:id/files', auth, fileController.list);
router.delete('/:id/files/:fileId', auth, fileController.remove);

export default router;
