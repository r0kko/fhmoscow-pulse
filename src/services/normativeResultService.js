import {
  NormativeResult,
  NormativeType,
  Season,
  User,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = {};
  if (options.season_id) where.season_id = options.season_id;
  return NormativeResult.findAndCountAll({
    order: [['created_at', 'DESC']],
    limit,
    offset,
    where,
  });
}

async function getById(id) {
  const res = await NormativeResult.findByPk(id);
  if (!res) throw new ServiceError('normative_result_not_found', 404);
  return res;
}

async function create(data, actorId) {
  const [user, season, type] = await Promise.all([
    User.findByPk(data.user_id),
    Season.findByPk(data.season_id),
    NormativeType.findByPk(data.type_id),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!season) throw new ServiceError('season_not_found', 404);
  if (!type) throw new ServiceError('normative_type_not_found', 404);
  if (type.season_id !== data.season_id) {
    throw new ServiceError('normative_type_invalid_season');
  }
  return await NormativeResult.create({
    user_id: data.user_id,
    season_id: data.season_id,
    training_id: data.training_id,
    type_id: data.type_id,
    value_type_id: data.value_type_id,
    unit_id: data.unit_id,
    value: data.value,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function update(id, data, actorId) {
  const res = await NormativeResult.findByPk(id);
  if (!res) throw new ServiceError('normative_result_not_found', 404);
  await res.update(
    {
      training_id: data.training_id ?? res.training_id,
      value: data.value ?? res.value,
      updated_by: actorId,
    },
    { returning: false }
  );
  return res;
}

async function remove(id, actorId = null) {
  const res = await NormativeResult.findByPk(id);
  if (!res) throw new ServiceError('normative_result_not_found', 404);
  await res.update({ updated_by: actorId });
  await res.destroy();
}

export default { listAll, getById, create, update, remove };
