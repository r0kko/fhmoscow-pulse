import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/courseUserAdminController.js';
import { assignCourseRules } from '../validators/courseUserValidators.js';

const router = express.Router();

router.get('/:id', auth, authorize('ADMIN'), controller.list);

router.post(
  '/:id',
  auth,
  authorize('ADMIN'),
  assignCourseRules,
  controller.addCourse
);
router.delete(
  '/:id/:courseId',
  auth,
  authorize('ADMIN'),
  controller.removeCourse
);

export default router;
