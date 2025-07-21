import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/seasonController.js';

const router = express.Router();

router.get('/', auth, controller.list);
router.get('/active', auth, controller.getActive);

export default router;
