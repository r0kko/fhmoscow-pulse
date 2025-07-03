import { JudgeGroup, Season, JudgeGroupUser, User } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import generateAlias from '../utils/alias.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return JudgeGroup.findAndCountAll({
    include: [Season],
    order: [['name', 'ASC']],
    limit,
    offset,
  });
}

async function getById(id) {
  const group = await JudgeGroup.findByPk(id, { include: [Season, User] });
  if (!group) throw new ServiceError('judge_group_not_found', 404);
  return group;
}

async function create(data, actorId) {
  const group = await JudgeGroup.create({
    season_id: data.season_id,
    name: data.name,
    alias: generateAlias(data.name),
    created_by: actorId,
    updated_by: actorId,
  });
  return group;
}

async function update(id, data, actorId) {
  const group = await JudgeGroup.findByPk(id);
  if (!group) throw new ServiceError('judge_group_not_found', 404);
  await group.update(
    {
      season_id: data.season_id ?? group.season_id,
      name: data.name ?? group.name,
      alias: data.name ? generateAlias(data.name) : group.alias,
      updated_by: actorId,
    },
    { returning: false }
  );
  return group;
}

async function addUser(groupId, userId, actorId) {
  await JudgeGroupUser.create({ group_id: groupId, user_id: userId, created_by: actorId, updated_by: actorId });
}

async function removeUser(userId) {
  const link = await JudgeGroupUser.findOne({ where: { user_id: userId } });
  if (link) await link.destroy();
}

async function remove(id) {
  const group = await JudgeGroup.findByPk(id);
  if (!group) throw new ServiceError('judge_group_not_found', 404);
  await group.destroy();
}

export default { listAll, getById, create, update, addUser, removeUser, remove };
