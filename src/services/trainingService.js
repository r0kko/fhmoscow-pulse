import {
  Training,
  TrainingType,
  CampStadium,
  Season,
  RefereeGroup,
  TrainingRefereeGroup,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

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
  const { rows, count } = await Training.findAndCountAll({
    include: [
      TrainingType,
      CampStadium,
      Season,
      { model: RefereeGroup, through: { attributes: [] } },
    ],
    order: [['start_at', 'DESC']],
    limit,
    offset,
  });
  return {
    rows: rows.map((t) => ({
      ...t.get(),
      registration_open: isRegistrationOpen(t),
    })),
    count,
  };
}

async function getById(id) {
  const training = await Training.findByPk(id, {
    include: [
      TrainingType,
      CampStadium,
      Season,
      { model: RefereeGroup, through: { attributes: [] } },
    ],
  });
  if (!training) throw new ServiceError('training_not_found', 404);
  const plain = typeof training.get === 'function' ? training.get() : training;
  return { ...plain, registration_open: isRegistrationOpen(training) };
}

async function create(data, actorId) {
  const training = await Training.create({
    type_id: data.type_id,
    camp_stadium_id: data.camp_stadium_id,
    season_id: data.season_id,
    start_at: data.start_at,
    end_at: data.end_at,
    capacity: data.capacity,
    created_by: actorId,
    updated_by: actorId,
  });
  if (Array.isArray(data.groups)) {
    const groups = await RefereeGroup.findAll({ where: { id: data.groups } });
    const seasonGroups = groups.filter(
      (g) => g.season_id === training.season_id
    );
    if (seasonGroups.length !== data.groups.length) {
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
      camp_stadium_id: data.camp_stadium_id ?? training.camp_stadium_id,
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

async function remove(id) {
  const training = await Training.findByPk(id);
  if (!training) throw new ServiceError('training_not_found', 404);
  await training.destroy();
}

export default {
  listAll,
  getById,
  create,
  update,
  remove,
  isRegistrationOpen,
};
