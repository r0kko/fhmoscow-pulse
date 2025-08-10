import {
  Training,
  TrainingType,
  Ground,
  Season,
  RefereeGroup,
  TrainingRefereeGroup,
  Course,
  TrainingCourse,
  Address,
  User,
  TrainingRole,
  Role,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import TrainingRegistration from '../models/trainingRegistration.js';
import { hasAdminRole, hasRefereeRole } from '../utils/roles.js';

function isRegistrationOpen(training, registeredCount = 0) {
  const start = new Date(training.start_at);
  const openAt = new Date(start);
  openAt.setUTCDate(openAt.getUTCDate() - 7);
  const closeAt = new Date(start);
  closeAt.setUTCMinutes(closeAt.getUTCMinutes() - 45);
  if (training.capacity && registeredCount >= training.capacity) return false;
  const now = new Date();
  return now >= openAt && now < closeAt;
}

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = {};
  if (options.ground_id) {
    where.ground_id = options.ground_id;
  }
  const { rows, count } = await Training.findAndCountAll({
    include: [
      {
        model: TrainingType,
        ...(options.forCamp !== undefined
          ? { where: { for_camp: options.forCamp } }
          : {}),
      },
      { model: Ground, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      {
        model: RefereeGroup,
        through: { attributes: [] },
        ...(options.group_id ? { where: { id: options.group_id } } : {}),
      },
      {
        model: Course,
        through: { attributes: [] },
        ...(options.course_id ? { where: { id: options.course_id } } : {}),
      },
      { model: TrainingRegistration, include: [User, TrainingRole] },
    ],
    distinct: true,
    order: [['start_at', 'ASC']],
    where,
    limit,
    offset,
  });
  return {
    rows: rows.map((t) => {
      const registeredCount = t.TrainingRegistrations?.length || 0;
      return {
        ...t.get(),
        registration_open: isRegistrationOpen(t, registeredCount),
        registered_count: registeredCount,
      };
    }),
    count,
  };
}

async function listUpcoming(options = {}) {
  const { Op } = await import('sequelize');
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = { start_at: { [Op.gte]: new Date() } };
  if (options.ground_id) {
    where.ground_id = options.ground_id;
  }
  const { rows, count } = await Training.findAndCountAll({
    include: [
      {
        model: TrainingType,
        ...(options.forCamp !== undefined
          ? { where: { for_camp: options.forCamp } }
          : {}),
      },
      { model: Ground, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      {
        model: RefereeGroup,
        through: { attributes: [] },
        ...(options.group_id ? { where: { id: options.group_id } } : {}),
      },
      {
        model: Course,
        through: { attributes: [] },
        ...(options.course_id ? { where: { id: options.course_id } } : {}),
      },
      { model: TrainingRegistration, include: [User, TrainingRole] },
    ],
    distinct: true,
    order: [['start_at', 'ASC']],
    where,
    limit,
    offset,
  });
  return {
    rows: rows.map((t) => {
      const registeredCount = t.TrainingRegistrations?.length || 0;
      return {
        ...t.get(),
        registration_open: isRegistrationOpen(t, registeredCount),
        registered_count: registeredCount,
      };
    }),
    count,
  };
}

async function listPast(options = {}) {
  const { Op } = await import('sequelize');
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = { start_at: { [Op.lt]: new Date() } };
  if (options.ground_id) {
    where.ground_id = options.ground_id;
  }
  const { rows, count } = await Training.findAndCountAll({
    include: [
      {
        model: TrainingType,
        ...(options.forCamp !== undefined
          ? { where: { for_camp: options.forCamp } }
          : {}),
      },
      { model: Ground, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      {
        model: RefereeGroup,
        through: { attributes: [] },
        ...(options.group_id ? { where: { id: options.group_id } } : {}),
      },
      {
        model: Course,
        through: { attributes: [] },
        ...(options.course_id ? { where: { id: options.course_id } } : {}),
      },
      { model: TrainingRegistration, include: [User, TrainingRole] },
    ],
    distinct: true,
    order: [['start_at', 'DESC']],
    where,
    limit,
    offset,
  });
  return {
    rows: rows.map((t) => {
      const registeredCount = t.TrainingRegistrations?.length || 0;
      return {
        ...t.get(),
        registration_open: isRegistrationOpen(t, registeredCount),
        registered_count: registeredCount,
      };
    }),
    count,
  };
}

async function getById(id, forCamp) {
  const training = await Training.findByPk(id, {
    include: [
      { model: TrainingType },
      { model: Ground, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      { model: RefereeGroup, through: { attributes: [] } },
      { model: Course, through: { attributes: [] } },
      { model: TrainingRegistration, include: [User, TrainingRole] },
    ],
  });
  if (!training) throw new ServiceError('training_not_found', 404);
  if (forCamp !== undefined && training.TrainingType?.for_camp !== forCamp) {
    throw new ServiceError('access_denied', 403);
  }
  const plain = typeof training.get === 'function' ? training.get() : training;
  return { ...plain, registration_open: isRegistrationOpen(training) };
}

async function create(data, actorId, forCamp) {
  const type = await TrainingType.findByPk(data.type_id);
  if (!type) throw new ServiceError('training_type_not_found', 404);
  if (forCamp !== undefined && type.for_camp !== forCamp) {
    throw new ServiceError('access_denied', 403);
  }
  if (!type.online && !data.ground_id) {
    throw new ServiceError('ground_required');
  }
  let seasonId = data.season_id;
  let groups = [];
  let courses = [];
  if (Array.isArray(data.groups) && data.groups.length) {
    groups = await RefereeGroup.findAll({ where: { id: data.groups } });
  }
  if (Array.isArray(data.courses) && data.courses.length) {
    courses = await Course.findAll({ where: { id: data.courses } });
  }
  if (!seasonId) {
    if (groups.length) {
      const uniq = [...new Set(groups.map((g) => g.season_id))];
      if (uniq.length === 1) {
        seasonId = uniq[0];
      } else {
        throw new ServiceError('invalid_group_season');
      }
    } else {
      const yearAlias = new Date(data.start_at).getUTCFullYear().toString();
      const season = await Season.findOne({ where: { alias: yearAlias } });
      if (!season) throw new ServiceError('season_not_found', 404);
      seasonId = season.id;
    }
  }
  const training = await Training.create({
    type_id: data.type_id,
    ground_id: type.online ? null : data.ground_id,
    url: type.online ? data.url : null,
    season_id: seasonId,
    start_at: data.start_at,
    end_at: data.end_at,
    capacity: data.capacity,
    created_by: actorId,
    updated_by: actorId,
  });
  if (groups.length) {
    const seasonGroups = groups.filter((g) => g.season_id === seasonId);
    if (seasonGroups.length !== groups.length) {
      throw new ServiceError('invalid_group_season');
    }
    await TrainingRefereeGroup.bulkCreate(
      seasonGroups.map((g) => ({
        training_id: training.id,
        group_id: g.id,
        created_by: actorId,
        updated_by: actorId,
      }))
    );
  }
  if (courses.length) {
    await TrainingCourse.bulkCreate(
      courses.map((c) => ({
        training_id: training.id,
        course_id: c.id,
        created_by: actorId,
        updated_by: actorId,
      }))
    );
  }
  return getById(training.id, forCamp);
}

async function update(id, data, actorId, forCamp) {
  const training = await Training.findByPk(id, { include: [TrainingType] });
  if (!training) throw new ServiceError('training_not_found', 404);
  if (forCamp !== undefined && training.TrainingType?.for_camp !== forCamp) {
    throw new ServiceError('access_denied', 403);
  }
  let finalType = training.TrainingType;
  if (data.type_id && data.type_id !== training.type_id) {
    const newType = await TrainingType.findByPk(data.type_id);
    if (!newType) throw new ServiceError('training_type_not_found', 404);
    if (forCamp !== undefined && newType.for_camp !== forCamp) {
      throw new ServiceError('access_denied', 403);
    }
    finalType = newType;
  }
  if (!finalType.online && !(data.ground_id ?? training.ground_id)) {
    throw new ServiceError('ground_required');
  }
  const newStart = data.start_at ? new Date(data.start_at) : training.start_at;
  const newEnd = data.end_at ? new Date(data.end_at) : training.end_at;
  if (newEnd <= newStart) {
    throw new ServiceError('invalid_time_range');
  }
  await training.update(
    {
      type_id: data.type_id ?? training.type_id,
      ground_id: finalType.online
        ? null
        : (data.ground_id ?? training.ground_id),
      url: finalType.online ? (data.url ?? training.url) : null,
      season_id: data.season_id ?? training.season_id,
      start_at: data.start_at ?? training.start_at,
      end_at: data.end_at ?? training.end_at,
      capacity: data.capacity ?? training.capacity,
      updated_by: actorId,
    },
    { returning: false }
  );
  if (data.groups !== undefined) {
    const seasonId = data.season_id ?? training.season_id;
    await TrainingRefereeGroup.destroy({ where: { training_id: id } });
    if (Array.isArray(data.groups) && data.groups.length) {
      const groups = await RefereeGroup.findAll({ where: { id: data.groups } });
      const seasonGroups = groups.filter((g) => g.season_id === seasonId);
      if (seasonGroups.length !== data.groups.length) {
        throw new ServiceError('invalid_group_season');
      }
      await TrainingRefereeGroup.bulkCreate(
        seasonGroups.map((g) => ({
          training_id: id,
          group_id: g.id,
          created_by: actorId,
          updated_by: actorId,
        }))
      );
    }
  }
  if (data.courses !== undefined) {
    await TrainingCourse.destroy({ where: { training_id: id } });
    if (Array.isArray(data.courses) && data.courses.length) {
      const courses = await Course.findAll({ where: { id: data.courses } });
      await TrainingCourse.bulkCreate(
        courses.map((c) => ({
          training_id: id,
          course_id: c.id,
          created_by: actorId,
          updated_by: actorId,
        }))
      );
    }
  }
  return getById(id, forCamp);
}

async function remove(id, actorId = null, forCamp) {
  const training = await Training.findByPk(id, { include: [TrainingType] });
  if (!training) throw new ServiceError('training_not_found', 404);
  if (forCamp !== undefined && training.TrainingType?.for_camp !== forCamp) {
    throw new ServiceError('access_denied', 403);
  }
  await training.update({ updated_by: actorId });
  await training.destroy();
}

async function setAttendanceMarked(id, marked, actorId, forCamp) {
  const training = await Training.findByPk(id, { include: [TrainingType] });
  if (!training) throw new ServiceError('training_not_found', 404);
  if (forCamp !== undefined && training.TrainingType?.for_camp !== forCamp) {
    throw new ServiceError('access_denied', 403);
  }
  const actor = await User.findByPk(actorId, { include: [Role] });
  if (!actor) throw new ServiceError('user_not_found', 404);
  const isAdmin = hasAdminRole(actor.Roles);
  let coachReg = null;
  if (!isAdmin) {
    if (!hasRefereeRole(actor.Roles)) {
      throw new ServiceError('access_denied');
    }
    coachReg = await TrainingRegistration.findOne({
      where: { training_id: id, user_id: actorId },
      include: [TrainingRole],
    });
    if (coachReg?.TrainingRole?.alias !== 'COACH') {
      throw new ServiceError('access_denied');
    }
  } else {
    coachReg = await TrainingRegistration.findOne({
      where: { training_id: id, user_id: actorId },
      include: [TrainingRole],
    });
  }

  await training.update({ attendance_marked: marked, updated_by: actorId });
  if (marked && coachReg?.TrainingRole?.alias === 'COACH') {
    await coachReg.update({ present: true, updated_by: actorId });
  }
  return getById(id, forCamp);
}

export default {
  listAll,
  getById,
  create,
  update,
  setAttendanceMarked,
  remove,
  listUpcoming,
  listPast,
  isRegistrationOpen,
};
