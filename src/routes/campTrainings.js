import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/trainingAdminController.js';
import {
  trainingCreateRules,
  trainingUpdateRules,
} from '../validators/trainingValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.get('/statuses', auth, authorize('ADMIN'), controller.statuses);
router.post('/', auth, authorize('ADMIN'), trainingCreateRules, controller.create);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put('/:id', auth, authorize('ADMIN'), trainingUpdateRules, controller.update);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
