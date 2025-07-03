import { Season } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import generateAlias from '../utils/alias.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return Season.findAndCountAll({ order: [['name', 'ASC']], limit, offset });
}

async function getById(id) {
  const season = await Season.findByPk(id);
  if (!season) throw new ServiceError('season_not_found', 404);
  return season;
}

async function create(data, actorId) {
  const season = await Season.create({
    name: data.name,
    alias: generateAlias(data.name),
    created_by: actorId,
    updated_by: actorId,
  });
  return season;
}

async function update(id, data, actorId) {
  const season = await Season.findByPk(id);
  if (!season) throw new ServiceError('season_not_found', 404);
  await season.update(
    {
      name: data.name ?? season.name,
      alias: data.name ? generateAlias(data.name) : season.alias,
      updated_by: actorId,
    },
    { returning: false }
  );
  return season;
}

async function remove(id) {
  const season = await Season.findByPk(id);
  if (!season) throw new ServiceError('season_not_found', 404);
  await season.destroy();
}

export default { listAll, getById, create, update, remove };
