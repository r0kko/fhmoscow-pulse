import { TrainingType } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import generateAlias from '../utils/alias.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = {};
  if (options.forCamp !== undefined) where.for_camp = options.forCamp;
  return TrainingType.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit,
    offset,
  });
}

async function getById(id, forCamp) {
  const type = await TrainingType.findByPk(id);
  if (!type || (forCamp !== undefined && type.for_camp !== forCamp)) {
    throw new ServiceError('training_type_not_found', 404);
  }
  return type;
}

async function create(data, actorId, forCamp) {
  const type = await TrainingType.create({
    name: data.name,
    alias: generateAlias(data.name),
    default_capacity: data.default_capacity,
    for_camp: forCamp,
    online: Boolean(data.online),
    created_by: actorId,
    updated_by: actorId,
  });
  return type;
}

async function update(id, data, actorId, forCamp) {
  const type = await getById(id, forCamp);
  await type.update(
    {
      name: data.name ?? type.name,
      alias: data.name ? generateAlias(data.name) : type.alias,
      default_capacity: data.default_capacity ?? type.default_capacity,
      online: data.online ?? type.online,
      updated_by: actorId,
    },
    { returning: false }
  );
  return type;
}

async function remove(id, actorId = null, forCamp) {
  const type = await getById(id, forCamp);
  await type.update({ updated_by: actorId });
  await type.destroy();
}
export default { listAll, getById, create, update, remove };
