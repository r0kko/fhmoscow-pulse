import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/addressController.js';
import selfController from '../controllers/addressSelfController.js';
import { addressRules } from '../validators/addressValidators.js';

const router = express.Router();

router.get('/:type', auth, controller.me);
router.post('/:type', auth, addressRules, selfController.create);
router.put('/:type', auth, addressRules, selfController.update);
router.delete('/:type', auth, selfController.remove);

export default router;
