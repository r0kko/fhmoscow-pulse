import normativeZoneMapper from './normativeZoneMapper.js';
import normativeGroupMapper from './normativeGroupMapper.js';

function sanitize(obj) {
  const {
    id,
    user_id,
    season_id,
    training_id,
    type_id,
    value_type_id,
    unit_id,
    value,
    zone,
    group,
  } = obj;
  const res = {
    id,
    user_id,
    season_id,
    training_id,
    type_id,
    value_type_id,
    unit_id,
    value,
  };
  if (zone) res.zone = normativeZoneMapper.toPublic(zone);
  if (group) res.group = normativeGroupMapper.toPublic(group);
  return res;
}

function toPublic(result) {
  if (!result) return null;
  const plain =
    typeof result.get === 'function' ? result.get({ plain: true }) : result;
  return sanitize(plain);
}

export default { toPublic };
