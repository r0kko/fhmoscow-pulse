import express from 'express';
import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/trainingRoleController.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);

export default router;
