import express from 'express';
import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/medicalCenterAdminController.js';
import {
  medicalCenterCreateRules,
  medicalCenterUpdateRules,
} from '../validators/medicalCenterValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.post('/', auth, authorize('ADMIN'), medicalCenterCreateRules, controller.create);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put('/:id', auth, authorize('ADMIN'), medicalCenterUpdateRules, controller.update);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
