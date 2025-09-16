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
  if (data.active) {
    await Season.update({ active: false }, { where: { active: true } });
  }
  return await Season.create({
    name: data.name,
    alias: generateAlias(data.name),
    active: Boolean(data.active),
    created_by: actorId,
    updated_by: actorId,
  });
}

async function update(id, data, actorId) {
  const season = await Season.findByPk(id);
  if (!season) throw new ServiceError('season_not_found', 404);
  if (data.active) {
    await Season.update({ active: false }, { where: { active: true } });
  }
  await season.update(
    {
      name: data.name ?? season.name,
      alias: data.name ? generateAlias(data.name) : season.alias,
      active: data.active ?? season.active,
      updated_by: actorId,
    },
    { returning: false }
  );
  return season;
}

async function getActive() {
  return Season.findOne({ where: { active: true } });
}

async function remove(id, actorId = null) {
  const season = await Season.findByPk(id);
  if (!season) throw new ServiceError('season_not_found', 404);
  await season.update({ updated_by: actorId });
  await season.destroy();
}

export default { listAll, getById, create, update, remove, getActive };
