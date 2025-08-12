import groundMapper from './groundMapper.js';
import userMapper from './userMapper.js';

function sanitize(obj) {
  const {
    id,
    start_at,
    end_at,
    capacity,
    ground_id,
    season_id,
    attendance_marked,
    TrainingType,
    Ground,
    Season,
    RefereeGroups,
    registered_count,
  } = obj;
  const res = {
    id,
    start_at: start_at?.toISOString?.() ?? start_at,
    end_at: end_at?.toISOString?.() ?? end_at,
    capacity,
    ground_id,
    season_id,
    available: obj.available,
    registration_open: obj.registration_open,
    registered: obj.user_registered,
    registered_count,
    attendance_marked,
  };
  if (TrainingType) {
    res.type = {
      id: TrainingType.id,
      name: TrainingType.name,
      alias: TrainingType.alias,
      online: TrainingType.online,
    };
  }
  if (Ground) {
    res.ground = groundMapper.toPublic(Ground);
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
  if (obj.Courses) {
    res.courses = obj.Courses.map((c) => ({ id: c.id, name: c.name }));
  }
  if (obj.TrainingRegistrations) {
    const coaches = obj.TrainingRegistrations.filter(
      (r) => r.TrainingRole?.alias === 'COACH' && r.User
    ).map((r) => userMapper.toPublic(r.User));
    if (coaches.length) res.coaches = coaches;
    const teacherReg = obj.TrainingRegistrations.find(
      (r) => r.TrainingRole?.alias === 'TEACHER' && r.User
    );
    if (teacherReg) res.teacher = userMapper.toPublic(teacherReg.User);
    const inventory = obj.TrainingRegistrations.filter(
      (r) => r.TrainingRole?.alias === 'EQUIPMENT_MANAGER' && r.User
    ).map((r) => userMapper.toPublic(r.User));
    if (inventory.length) res.equipment_managers = inventory;
  }
  if (obj.my_role) {
    res.my_role = { ...obj.my_role };
  }
  if (Object.prototype.hasOwnProperty.call(obj, 'my_presence')) {
    res.my_presence = obj.my_presence;
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
