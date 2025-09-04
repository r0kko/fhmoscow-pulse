import { body } from 'express-validator';

function isUuidLike(val) {
  return typeof val === 'string' && val.length > 0;
}

export const setLineupRules = [
  body('team_id').isString().notEmpty().withMessage('team_id_required'),
  // Allow either simple player_ids array OR detailed players array
  body().custom((body) => {
    if (Array.isArray(body.players)) return true;
    if (Array.isArray(body.player_ids)) return true;
    throw new Error('player_ids_must_be_array');
  }),
  body('players')
    .optional()
    .isArray()
    .withMessage('player_ids_must_be_array')
    .custom((arr) => {
      for (const p of arr) {
        if (!p || !isUuidLike(p.team_player_id)) return false;
        if (!(p.selected === undefined || typeof p.selected === 'boolean'))
          return false;
        if (
          !(
            p.number == null ||
            (Number.isFinite(p.number) && p.number >= 0 && p.number <= 99)
          )
        )
          return false;
        // If selected, allow progressive save without mandatory role_id.
        // Validate optional leadership fields and squad_no format.
        if (p.selected) {
          if (
            !(p.is_captain === undefined || typeof p.is_captain === 'boolean')
          )
            return false;
          if (
            !(
              p.assistant_order == null ||
              (Number.isFinite(p.assistant_order) &&
                [1, 2].includes(p.assistant_order))
            )
          )
            return false;
          if (p.is_captain && p.assistant_order != null) {
            throw new Error('captain_cannot_be_assistant');
          }
          // Optional: squad_no for double protocol (1 or 2)
          if (
            !(
              p.squad_no == null ||
              (Number.isFinite(p.squad_no) &&
                [1, 2].includes(Number(p.squad_no)))
            )
          )
            return false;
          // Optional: squad_both flag
          if (
            !(p.squad_both === undefined || typeof p.squad_both === 'boolean')
          )
            return false;
          if (!(p.role_id == null || isUuidLike(p.role_id))) return false;
        } else {
          if (!(p.role_id == null || isUuidLike(p.role_id))) return false;
          if (!(p.is_captain == null || p.is_captain === false)) return false;
          if (!(p.assistant_order == null)) return false;
          if (!(p.squad_no == null)) return false;
          if (!(p.squad_both == null || p.squad_both === false)) return false;
        }
      }
      return true;
    })
    .withMessage('player_ids_must_be_array_of_strings'),
  body('player_ids')
    .optional()
    .isArray()
    .withMessage('player_ids_must_be_array')
    .custom((arr) => arr.every((x) => typeof x === 'string' && x.length > 0))
    .withMessage('player_ids_must_be_array_of_strings'),
  // Do not enforce global leadership counts here; handled in service per protocol type
];

export default { setLineupRules };
