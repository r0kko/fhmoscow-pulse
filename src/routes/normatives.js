import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/normativeSelfController.js';

const router = express.Router();

router.get('/', auth, authorize('REFEREE'), controller.list);

export default router;
