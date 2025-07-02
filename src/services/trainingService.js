import { Training, TrainingStatus, TrainingType } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return Training.findAndCountAll({
    include: [TrainingType, TrainingStatus],
    order: [['start_at', 'DESC']],
    limit,
    offset,
  });
}

async function getById(id) {
  const training = await Training.findByPk(id, { include: [TrainingType, TrainingStatus] });
  if (!training) throw new ServiceError('training_not_found', 404);
  return training;
}

async function create(data, actorId) {
  const status = await TrainingStatus.findOne({ where: { alias: 'SCHEDULED' } });
  if (!status) throw new ServiceError('training_status_not_found');
  const training = await Training.create({
    type_id: data.type_id,
    status_id: status.id,
    start_at: data.start_at,
    end_at: data.end_at,
    capacity: data.capacity,
    created_by: actorId,
    updated_by: actorId,
  });
  return getById(training.id);
}

async function update(id, data, actorId) {
  const training = await Training.findByPk(id);
  if (!training) throw new ServiceError('training_not_found', 404);
  let statusId = training.status_id;
  if (data.status) {
    const st = await TrainingStatus.findOne({ where: { alias: data.status } });
    if (!st) throw new ServiceError('training_status_not_found');
    statusId = st.id;
  }
  await training.update(
    {
      type_id: data.type_id ?? training.type_id,
      status_id: statusId,
      start_at: data.start_at ?? training.start_at,
      end_at: data.end_at ?? training.end_at,
      capacity: data.capacity ?? training.capacity,
      updated_by: actorId,
    },
    { returning: false }
  );
  return getById(id);
}

async function remove(id) {
  const training = await Training.findByPk(id);
  if (!training) throw new ServiceError('training_not_found', 404);
  await training.destroy();
}

async function listStatuses() {
  return TrainingStatus.findAll({ order: [['id', 'ASC']] });
}

export default {
  listAll,
  getById,
  create,
  update,
  remove,
  listStatuses,
};
