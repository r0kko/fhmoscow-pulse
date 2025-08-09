import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/courseUserAdminController.js';
import { setCourseRules } from '../validators/courseUserValidators.js';

const router = express.Router();

router.get('/', auth, authorize('ADMIN'), controller.listAll);
router.get('/:id', auth, authorize('ADMIN'), controller.list);

router.post(
  '/:id',
  auth,
  authorize('ADMIN'),
  setCourseRules,
  controller.setCourse
);
router.delete('/:id', auth, authorize('ADMIN'), controller.clearCourse);

export default router;
