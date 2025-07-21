import normativeZoneMapper from './normativeZoneMapper.js';
import normativeGroupMapper from './normativeGroupMapper.js';
import userMapper from './userMapper.js';
import trainingMapper from './trainingMapper.js';

function sanitize(obj) {
  const {
    id,
    user_id,
    season_id,
    training_id,
    type_id,
    value_type_id,
    unit_id,
    online,
    retake,
    value,
    zone,
    NormativeZone,
    group,
    User,
    Training,
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
    online,
    retake,
  };
  const zoneObj = zone || NormativeZone;
  if (zoneObj) res.zone = normativeZoneMapper.toPublic(zoneObj);
  if (group) res.group = normativeGroupMapper.toPublic(group);
  if (User) res.user = userMapper.toPublic(User);
  if (Training) res.training = trainingMapper.toPublic(Training);
  return res;
}

function toPublic(result) {
  if (!result) return null;
  const plain =
    typeof result.get === 'function' ? result.get({ plain: true }) : result;
  return sanitize(plain);
}

export default { toPublic };
