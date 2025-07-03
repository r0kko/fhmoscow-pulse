import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/seasonAdminController.js';
import { seasonCreateRules, seasonUpdateRules } from '../validators/seasonValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.post('/', auth, authorize('ADMIN'), seasonCreateRules, controller.create);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put('/:id', auth, authorize('ADMIN'), seasonUpdateRules, controller.update);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
