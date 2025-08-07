import {
  Training,
  TrainingType,
  Ground,
  Season,
  RefereeGroup,
  TrainingRefereeGroup,
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
  openAt.setDate(openAt.getDate() - 7);
  const closeAt = new Date(start);
  closeAt.setMinutes(closeAt.getMinutes() - 45);
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
      TrainingType,
      { model: Ground, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      {
        model: RefereeGroup,
        through: { attributes: [] },
        ...(options.group_id ? { where: { id: options.group_id } } : {}),
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
      TrainingType,
      { model: Ground, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      {
        model: RefereeGroup,
        through: { attributes: [] },
        ...(options.group_id ? { where: { id: options.group_id } } : {}),
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
      TrainingType,
      { model: Ground, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      {
        model: RefereeGroup,
        through: { attributes: [] },
        ...(options.group_id ? { where: { id: options.group_id } } : {}),
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

async function getById(id) {
  const training = await Training.findByPk(id, {
    include: [
      TrainingType,
      { model: Ground, include: [Address] },
      { model: Season, where: { active: true }, required: true },
      { model: RefereeGroup, through: { attributes: [] } },
      { model: TrainingRegistration, include: [User, TrainingRole] },
    ],
  });
  if (!training) throw new ServiceError('training_not_found', 404);
  const plain = typeof training.get === 'function' ? training.get() : training;
  return { ...plain, registration_open: isRegistrationOpen(training) };
}

async function create(data, actorId) {
  let seasonId = data.season_id;
  let groups = [];
  if (Array.isArray(data.groups) && data.groups.length) {
    groups = await RefereeGroup.findAll({ where: { id: data.groups } });
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
      const yearAlias = new Date(data.start_at).getFullYear().toString();
      const season = await Season.findOne({ where: { alias: yearAlias } });
      if (!season) throw new ServiceError('season_not_found', 404);
      seasonId = season.id;
    }
  }
  const training = await Training.create({
    type_id: data.type_id,
    ground_id: data.ground_id,
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
  return getById(training.id);
}

async function update(id, data, actorId) {
  const training = await Training.findByPk(id);
  if (!training) throw new ServiceError('training_not_found', 404);
  const newStart = data.start_at ? new Date(data.start_at) : training.start_at;
  const newEnd = data.end_at ? new Date(data.end_at) : training.end_at;
  if (newEnd <= newStart) {
    throw new ServiceError('invalid_time_range');
  }
  await training.update(
    {
      type_id: data.type_id ?? training.type_id,
      ground_id: data.ground_id ?? training.ground_id,
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
  return getById(id);
}

async function remove(id, actorId = null) {
  const training = await Training.findByPk(id);
  if (!training) throw new ServiceError('training_not_found', 404);
  await training.update({ updated_by: actorId });
  await training.destroy();
}

async function setAttendanceMarked(id, marked, actorId) {
  const training = await Training.findByPk(id);
  if (!training) throw new ServiceError('training_not_found', 404);
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
  return getById(id);
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
