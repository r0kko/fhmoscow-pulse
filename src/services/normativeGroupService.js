import { NormativeGroup, NormativeGroupType, Season } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import generateAlias from '../utils/alias.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = {};
  if (options.season_id) where.season_id = options.season_id;
  return NormativeGroup.findAndCountAll({
    order: [['name', 'ASC']],
    limit,
    offset,
    where,
  });
}

async function getById(id) {
  const group = await NormativeGroup.findByPk(id);
  if (!group) throw new ServiceError('normative_group_not_found', 404);
  return group;
}

async function create(data, actorId) {
  const season = await Season.findByPk(data.season_id);
  if (!season) throw new ServiceError('season_not_found', 404);
  return await NormativeGroup.create({
    season_id: data.season_id,
    name: data.name,
    alias: generateAlias(data.name),
    required: Boolean(data.required),
    created_by: actorId,
    updated_by: actorId,
  });
}

async function update(id, data, actorId) {
  const group = await NormativeGroup.findByPk(id);
  if (!group) throw new ServiceError('normative_group_not_found', 404);
  await group.update(
    {
      name: data.name ?? group.name,
      alias: data.name ? generateAlias(data.name) : group.alias,
      required: data.required ?? group.required,
      updated_by: actorId,
    },
    { returning: false }
  );
  return group;
}

async function remove(id, actorId = null) {
  const group = await NormativeGroup.findByPk(id);
  if (!group) throw new ServiceError('normative_group_not_found', 404);
  const count = await NormativeGroupType.count({ where: { group_id: id } });
  if (count > 0) throw new ServiceError('normative_group_in_use');
  await group.update({ updated_by: actorId });
  await group.destroy();
}

export default { listAll, getById, create, update, remove };
