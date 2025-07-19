import {
  NormativeType,
  NormativeTypeZone,
  NormativeGroupType,
  Season,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import generateAlias from '../utils/alias.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = {};
  if (options.season_id) where.season_id = options.season_id;
  return NormativeType.findAndCountAll({
    include: [NormativeTypeZone],
    order: [['name', 'ASC']],
    limit,
    offset,
    where,
  });
}

async function getById(id) {
  const type = await NormativeType.findByPk(id, {
    include: [NormativeTypeZone],
  });
  if (!type) throw new ServiceError('normative_type_not_found', 404);
  return type;
}

async function create(data, actorId) {
  const season = await Season.findByPk(data.season_id);
  if (!season) throw new ServiceError('season_not_found', 404);
  const type = await NormativeType.create({
    season_id: data.season_id,
    name: data.name,
    alias: generateAlias(data.name),
    required: Boolean(data.required),
    value_type_id: data.value_type_id,
    unit_id: data.unit_id,
    created_by: actorId,
    updated_by: actorId,
  });
  if (Array.isArray(data.zones)) {
    await NormativeTypeZone.bulkCreate(
      data.zones.map((z) => ({
        normative_type_id: type.id,
        zone_id: z.zone_id,
        min_value: z.min_value,
        max_value: z.max_value,
        created_at: new Date(),
        updated_at: new Date(),
      }))
    );
  }
  return getById(type.id);
}

async function update(id, data, actorId) {
  const type = await NormativeType.findByPk(id);
  if (!type) throw new ServiceError('normative_type_not_found', 404);
  await type.update(
    {
      name: data.name ?? type.name,
      alias: data.name ? generateAlias(data.name) : type.alias,
      required: data.required ?? type.required,
      value_type_id: data.value_type_id ?? type.value_type_id,
      unit_id: data.unit_id ?? type.unit_id,
      updated_by: actorId,
    },
    { returning: false }
  );
  if (data.zones) {
    await NormativeTypeZone.destroy({ where: { normative_type_id: id } });
    if (Array.isArray(data.zones)) {
      await NormativeTypeZone.bulkCreate(
        data.zones.map((z) => ({
          normative_type_id: id,
          zone_id: z.zone_id,
          min_value: z.min_value,
          max_value: z.max_value,
          created_at: new Date(),
          updated_at: new Date(),
        }))
      );
    }
  }
  return getById(id);
}

async function remove(id, actorId = null) {
  const type = await NormativeType.findByPk(id);
  if (!type) throw new ServiceError('normative_type_not_found', 404);
  const count = await NormativeGroupType.count({ where: { type_id: id } });
  if (count > 0) throw new ServiceError('normative_type_in_use');
  await type.update({ updated_by: actorId });
  await type.destroy();
}

export default { listAll, getById, create, update, remove };
