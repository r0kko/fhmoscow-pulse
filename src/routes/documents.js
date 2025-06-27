import express from 'express';

import auth from '../middlewares/auth.js';
import documentController from '../controllers/documentController.js';

const router = express.Router();

router.get('/me', auth, documentController.list);

export default router;
