import express from 'express';

import auth from '../middlewares/auth.js';
import authorize from '../middlewares/authorize.js';
import sportSchoolAdminController from '../controllers/sportSchoolAdminController.js';

const router = express.Router();

/**
 * @swagger
 * /sport-schools/assignments:
 *   get:
 *     security:
 *       - bearerAuth: []
 *     summary: List club/team assignments with staff overview
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by club or team name
 *       - in: query
 *         name: birth_year
 *         schema: { type: integer }
 *         description: Team birth year filter
 *       - in: query
 *         name: has_staff
 *         schema: { type: string, enum: ["true", "false", ""] }
 *         description: Filter by presence of staff on a team/club
 *       - in: query
 *         name: staff
 *         schema: { type: string }
 *         description: Search by staff full name
 *     responses:
 *       200:
 *         description: Paginated items with club, team and staff
 */
router.get(
  '/assignments',
  auth,
  authorize('ADMIN'),
  sportSchoolAdminController.listAssignments
);

export default router;
