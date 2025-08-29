import express from 'express';
import multer from 'multer';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import selfController from '../controllers/ticketSelfController.js';
import adminController from '../controllers/ticketAdminController.js';
import fileController from '../controllers/ticketFileController.js';
import {
  createTicketRules,
  updateTicketRules,
} from '../validators/ticketValidators.js';
import validate from '../middlewares/validate.js';

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

router.get('/', auth, authorize('ADMIN'), adminController.listAll);

/**
 * @swagger
 * /tickets:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create ticket
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type_alias:
 *                 type: string
 *               description:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Created ticket
 */
router.post(
  '/',
  auth,
  authorize('REFEREE'),
  upload.single('file'),
  createTicketRules,
  validate,
  selfController.create
);

router.put(
  '/:id',
  auth,
  authorize('ADMIN'),
  updateTicketRules,
  validate,
  adminController.updateById
);

router.post(
  '/:id/progress',
  auth,
  authorize('ADMIN'),
  adminController.progressStatus
);

router.post('/:id/files', auth, upload.single('file'), fileController.upload);
router.get('/:id/files', auth, fileController.list);
router.delete('/:id/files/:fileId', auth, fileController.remove);
router.delete('/:id', auth, authorize('REFEREE'), selfController.remove);

export default router;
