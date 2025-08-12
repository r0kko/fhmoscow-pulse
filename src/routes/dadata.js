import express from 'express';

import auth from '../middlewares/auth.js';
import controller from '../controllers/dadataController.js';

const router = express.Router();

/**
 * @swagger
 * /dadata/suggest-fio:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Get FIO suggestions
 *     responses:
 *       200:
 *         description: Array of suggestions
 */
router.post('/suggest-fio', auth, controller.suggestFio);

/**
 * @swagger
 * /dadata/clean-fio:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Standardize FIO
 *     responses:
 *       200:
 *         description: Standardized object
 */
router.post('/clean-fio', auth, controller.cleanFio);

/**
 * @swagger
 * /dadata/suggest-address:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Get address suggestions
 *     responses:
 *       200:
 *         description: Array of suggestions
 */
router.post('/suggest-address', auth, controller.suggestAddress);

/**
 * @swagger
 * /dadata/clean-address:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Standardize address
 *     responses:
 *       200:
 *         description: Standardized object
 */
router.post('/clean-address', auth, controller.cleanAddress);

/**
 * @swagger
 * /dadata/suggest-fms-unit:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Get FMS unit suggestions
 *     responses:
 *       200:
 *         description: Array of suggestions
 */
router.post('/suggest-fms-unit', auth, controller.suggestFmsUnit);

/**
 * @swagger
 * /dadata/clean-passport:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Validate passport number
 *     responses:
 *       200:
 *         description: Standardized object
 */
router.post('/clean-passport', auth, controller.cleanPassport);

/**
 * @swagger
 * /dadata/find-bank:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Find bank by BIC or name
 *     responses:
 *       200:
 *         description: Bank information
 */
router.post('/find-bank', auth, controller.findBank);

/**
 * @swagger
 * /dadata/find-organization:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Find organization by INN
 *     responses:
 *       200:
 *         description: Organization information
 */
router.post('/find-organization', auth, controller.findOrganization);

/**
 * @swagger
 * /dadata/clean-vehicle:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Standardize vehicle brand and model
 *     responses:
 *       200:
 *         description: Standardized object
 */
router.post('/clean-vehicle', auth, controller.cleanVehicle);

export default router;
