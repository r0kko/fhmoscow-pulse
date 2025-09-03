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
        // If selected, role_id is required
        if (p.selected) {
          if (!(p.role_id && isUuidLike(p.role_id))) {
            throw new Error('match_role_required');
          }
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
        } else {
          if (!(p.role_id == null || isUuidLike(p.role_id))) return false;
          if (!(p.is_captain == null || p.is_captain === false)) return false;
          if (!(p.assistant_order == null)) return false;
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
  body('players')
    .optional()
    .custom((arr) => {
      let cap = 0;
      let asst = 0;
      const seen = new Set();
      const dup = new Set();
      for (const p of arr) {
        if (!p || !p.selected) continue;
        if (p.is_captain) cap += 1;
        if (p.assistant_order != null) asst += 1;
        if (p.number != null) {
          const key = String(p.number);
          if (seen.has(key)) dup.add(key);
          else seen.add(key);
        }
      }
      if (cap > 1) throw new Error('too_many_captains');
      if (asst > 2) throw new Error('too_many_assistants');
      if (dup.size > 0) throw new Error('duplicate_match_numbers');
      return true;
    }),
];

export default { setLineupRules };
