import { body } from 'express-validator';

export const setMatchStaffRules = [
  body('team_id').isString().notEmpty().withMessage('team_id_required'),
  // Allow either simple staff_ids OR detailed staff array
  body().custom((body) => {
    if (Array.isArray(body.staff)) return true;
    if (Array.isArray(body.staff_ids)) return true;
    throw new Error('staff_ids_must_be_array');
  }),
  body('staff')
    .optional()
    .isArray()
    .withMessage('staff_ids_must_be_array')
    .custom((arr) => {
      for (const r of arr) {
        if (!r || typeof r.team_staff_id !== 'string' || !r.team_staff_id)
          return false;
        if (!(r.selected === undefined || typeof r.selected === 'boolean'))
          return false;
        // If selected, role_id is required (use staff_categories id)
        if (r.selected) {
          if (!(typeof r.role_id === 'string' && r.role_id.length > 0))
            throw new Error('staff_role_required');
        } else {
          if (
            !(
              r.role_id == null ||
              (typeof r.role_id === 'string' && r.role_id.length > 0)
            )
          )
            return false;
        }
      }
      return true;
    })
    .withMessage('staff_ids_must_be_array_of_strings'),
  body('staff_ids')
    .optional()
    .isArray()
    .withMessage('staff_ids_must_be_array')
    .custom((arr) => arr.every((x) => typeof x === 'string' && x.length > 0))
    .withMessage('staff_ids_must_be_array_of_strings'),
];

export default { setMatchStaffRules };
