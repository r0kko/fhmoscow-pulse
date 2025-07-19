import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/measurementUnitController.js';

const router = express.Router();

router.get('/', auth, controller.list);

export default router;
