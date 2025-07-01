import { TrainingType } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return TrainingType.findAndCountAll({
    order: [['name', 'ASC']],
    limit,
    offset,
  });
}

async function getById(id) {
  const type = await TrainingType.findByPk(id);
  if (!type) throw new ServiceError('training_type_not_found', 404);
  return type;
}

async function create(data, actorId) {
  const type = await TrainingType.create({
    name: data.name,
    alias: data.alias,
    default_capacity: data.default_capacity,
    created_by: actorId,
    updated_by: actorId,
  });
  return type;
}

async function update(id, data, actorId) {
  const type = await TrainingType.findByPk(id);
  if (!type) throw new ServiceError('training_type_not_found', 404);
  await type.update(
    {
      // name cannot be changed after creation
      alias: data.alias ?? type.alias,
      default_capacity: data.default_capacity ?? type.default_capacity,
      updated_by: actorId,
    },
    { returning: false }
  );
  return type;
}

async function remove(id) {
  const type = await TrainingType.findByPk(id);
  if (!type) throw new ServiceError('training_type_not_found', 404);
  await type.destroy();
}

export default { listAll, getById, create, update, remove };
