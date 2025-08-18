import express from 'express';

import auth from '../middlewares/auth.js';
import requireActive from '../middlewares/requireActive.js';
import controller from '../controllers/userAvailabilityController.js';

const router = express.Router();

router.get('/', auth, requireActive, controller.list);
router.put('/', auth, requireActive, controller.set);

export default router;
