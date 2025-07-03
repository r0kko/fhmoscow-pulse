import campStadiumMapper from './campStadiumMapper.js';
import userMapper from './userMapper.js';

function sanitize(obj) {
  const {
    id,
    start_at,
    end_at,
    capacity,
    camp_stadium_id,
    season_id,
    TrainingType,
    CampStadium,
    Season,
    RefereeGroups,
    registered_count,
  } = obj;
  const res = {
    id,
    start_at,
    end_at,
    capacity,
    camp_stadium_id,
    season_id,
    available: obj.available,
    registration_open: obj.registration_open,
    registered: obj.user_registered,
    registered_count,
  };
  if (TrainingType) {
    res.type = {
      id: TrainingType.id,
      name: TrainingType.name,
      alias: TrainingType.alias,
    };
  }
  if (CampStadium) {
    res.stadium = campStadiumMapper.toPublic(CampStadium);
  }
  if (Season) {
    res.season = {
      id: Season.id,
      name: Season.name,
      alias: Season.alias,
    };
  }
  if (RefereeGroups) {
    res.groups = RefereeGroups.map((g) => ({ id: g.id, name: g.name }));
  }
  if (obj.TrainingRegistrations) {
    const coaches = obj.TrainingRegistrations.filter(
      (r) => r.TrainingRole?.alias === 'COACH' && r.User
    ).map((r) => userMapper.toPublic(r.User));
    if (coaches.length) res.coaches = coaches;
    const inventory = obj.TrainingRegistrations.filter(
      (r) => r.TrainingRole?.alias === 'EQUIPMENT_MANAGER' && r.User
    ).map((r) => userMapper.toPublic(r.User));
    if (inventory.length) res.equipment_managers = inventory;
  }
  return res;
}

function toPublic(training) {
  if (!training) return null;
  const plain =
    typeof training.get === 'function'
      ? training.get({ plain: true })
      : training;
  return sanitize(plain);
}

export default { toPublic };
