import express from 'express';
import multer from 'multer';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import controller from '../controllers/playerController.js';
import accessScope from '../middlewares/accessScope.js';

const router = express.Router();
const upload = multer();

router.get(
  '/',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.list
);
router.get(
  '/gallery',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.gallery
);
router.get(
  '/gallery/filters',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.galleryFilters
);
router.get(
  '/facets',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.facets
);
router.get(
  '/season-summary',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.seasonSummary
);
router.get(
  '/season-teams',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.seasonTeamSummary
);
router.post('/sync', auth, authorize('ADMIN'), controller.sync);

// Update anthropometry + roster (jersey number + role) for a player within a specific team/season
router.patch(
  '/:id/anthro-and-roster',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  controller.updateAnthroAndRoster
);

// Player roles list for UI selectors
router.get(
  '/roles',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  controller.roles
);

router.post(
  '/:id/photo-request',
  auth,
  authorize('ADMIN', 'SPORT_SCHOOL_STAFF'),
  accessScope,
  upload.single('file'),
  controller.submitPhotoRequest
);

export default router;
