import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import validate from '../middlewares/validate.js';
import controller from '../controllers/refereeAccountingController.js';
import closingController from '../controllers/refereeClosingDocumentController.js';
import {
  accrualListRules,
  accrualIdRules,
  accrualActionRules,
  accrualBulkActionRules,
  accrualAdjustmentRules,
  accrualDeleteRules,
  accrualBulkDeleteRules,
} from '../validators/refereeAccountingValidators.js';
import { closingTournamentListRules } from '../validators/refereeClosingDocumentValidators.js';

const router = express.Router();

router.get(
  '/closing-documents/tournaments',
  auth,
  authorize('ADMINISTRATOR'),
  closingTournamentListRules,
  validate,
  closingController.listClosingTournaments
);

router.get(
  '/ref-data',
  auth,
  authorize('ADMINISTRATOR'),
  controller.getRefData
);

router.get(
  '/referee-accruals',
  auth,
  authorize('ADMINISTRATOR'),
  accrualListRules,
  validate,
  controller.listGlobalAccruals
);
router.get(
  '/referee-accruals/export.csv',
  auth,
  authorize('ADMINISTRATOR'),
  accrualListRules,
  validate,
  controller.exportAccrualsCsv
);
router.get(
  '/referee-accruals/:id',
  auth,
  authorize('ADMINISTRATOR'),
  accrualIdRules,
  validate,
  controller.getAccrualDocument
);
router.post(
  '/referee-accruals/:id/action',
  auth,
  authorize('ADMINISTRATOR'),
  [...accrualIdRules, ...accrualActionRules],
  validate,
  controller.actionAccrual
);
router.post(
  '/referee-accruals/bulk-action',
  auth,
  authorize('ADMINISTRATOR'),
  accrualBulkActionRules,
  validate,
  controller.bulkAccrualAction
);
router.post(
  '/referee-accruals/:id/adjust',
  auth,
  authorize('ADMINISTRATOR'),
  [...accrualIdRules, ...accrualAdjustmentRules],
  validate,
  controller.adjustAccrual
);
router.post(
  '/referee-accruals/:id/delete',
  auth,
  authorize('ADMINISTRATOR'),
  [...accrualIdRules, ...accrualDeleteRules],
  validate,
  controller.deleteAccrual
);
router.post(
  '/referee-accruals/bulk-delete',
  auth,
  authorize('ADMINISTRATOR'),
  accrualBulkDeleteRules,
  validate,
  controller.bulkDeleteAccruals
);

// Legacy action endpoints (kept for backward compatibility)
router.post(
  '/referee-accruals/:id/review',
  auth,
  authorize('ADMINISTRATOR'),
  accrualIdRules,
  validate,
  controller.reviewAccrual
);
router.post(
  '/referee-accruals/:id/approve',
  auth,
  authorize('ADMINISTRATOR'),
  accrualIdRules,
  validate,
  controller.approveAccrual
);
router.post(
  '/referee-accruals/:id/post',
  auth,
  authorize('ADMINISTRATOR'),
  accrualIdRules,
  validate,
  controller.postAccrual
);
router.post(
  '/referee-accruals/:id/void',
  auth,
  authorize('ADMINISTRATOR'),
  accrualIdRules,
  validate,
  controller.voidAccrual
);

export default router;
