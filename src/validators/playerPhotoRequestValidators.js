import { body, query } from 'express-validator';

export const listPlayerPhotoRequestsRules = [
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'all']),
  query('search').optional().isString().isLength({ max: 255 }),
  query('club_id').optional().isString().isLength({ max: 255 }),
  query('team_id').optional().isString().isLength({ max: 255 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

export const rejectPlayerPhotoRequestRules = [
  body('reason').optional({ nullable: true }).isString().isLength({ max: 500 }),
];
