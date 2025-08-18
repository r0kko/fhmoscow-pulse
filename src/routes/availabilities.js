import express from 'express';

import auth from '../middlewares/auth.js';
import requireActive from '../middlewares/requireActive.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/userAvailabilityController.js';

const router = express.Router();

router.get('/', auth, requireActive, authorize('REFEREE'), controller.list);
router.put('/', auth, requireActive, authorize('REFEREE'), controller.set);

export default router;
