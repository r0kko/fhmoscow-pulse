import express from 'express';
import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/medicalExamAdminController.js';
import { medicalExamCreateRules, medicalExamUpdateRules } from '../validators/medicalExamValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.list);
router.get('/statuses', auth, authorize('ADMIN'), controller.statuses);
router.post('/', auth, authorize('ADMIN'), medicalExamCreateRules, controller.create);
router.get('/:id', auth, authorize('ADMIN'), controller.get);
router.put('/:id', auth, authorize('ADMIN'), medicalExamUpdateRules, controller.update);
router.delete('/:id', auth, authorize('ADMIN'), controller.remove);

export default router;
