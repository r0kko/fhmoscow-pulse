import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/vehicleController.js';
import {
  vehicleCreateRules,
  vehicleUpdateRules,
} from '../validators/vehicleValidators.js';

const router = express.Router();

router.get('/me', auth, controller.me);
router.post('/', auth, vehicleCreateRules, controller.create);
router.patch('/:id', auth, vehicleUpdateRules, controller.update);
router.delete('/:id', auth, controller.remove);

export default router;
