import express from 'express';

import auth from '../middlewares/auth.js';
import requireActive from '../middlewares/requireActive.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/userAvailabilityController.js';

const router = express.Router();

router.get('/', auth, requireActive, authorize('REFEREE'), controller.list);
router.put('/', auth, requireActive, authorize('REFEREE'), controller.set);
router.get('/admin-grid', auth, authorize('ADMIN'), controller.adminGrid);
router.get('/admin/:userId', auth, authorize('ADMIN'), controller.adminDetail);
router.put('/admin/:userId', auth, authorize('ADMIN'), controller.adminSet);

export default router;
