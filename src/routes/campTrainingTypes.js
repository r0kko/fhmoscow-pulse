import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import createController from '../controllers/trainingTypeAdminController.js';

const controller = createController(true);
const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.get('/:id', auth, authorize('ADMIN'), controller.get);

export default router;
