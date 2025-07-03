import {
  RefereeGroup,
  RefereeGroupUser,
  Season,
  User,
  Role,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = {};
  if (options.season_id) where.season_id = options.season_id;
  return RefereeGroup.findAndCountAll({
    include: [Season],
    where,
    order: [['name', 'ASC']],
    limit,
    offset,
  });
}

async function getById(id) {
  const group = await RefereeGroup.findByPk(id, { include: [Season, User] });
  if (!group) throw new ServiceError('referee_group_not_found', 404);
  return group;
}

async function create(data, actorId) {
  return await RefereeGroup.create({
    season_id: data.season_id,
    name: data.name,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function update(id, data, actorId) {
  const group = await RefereeGroup.findByPk(id);
  if (!group) throw new ServiceError('referee_group_not_found', 404);
  await group.update(
    {
      season_id: data.season_id ?? group.season_id,
      name: data.name ?? group.name,
      updated_by: actorId,
    },
    { returning: false }
  );
  return group;
}

async function addUser(groupId, userId, actorId) {
  await RefereeGroupUser.create({
    group_id: groupId,
    user_id: userId,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function listReferees() {
  return User.findAll({
    include: [
      {
        model: Role,
        where: { alias: 'REFEREE' },
        through: { attributes: [] },
        required: true,
      },
      {
        model: RefereeGroupUser,
        include: [RefereeGroup],
        required: false,
      },
    ],
    order: [
      ['last_name', 'ASC'],
      ['first_name', 'ASC'],
    ],
  });
}

async function getReferee(id) {
  const user = await User.findByPk(id, {
    include: [
      {
        model: Role,
        where: { alias: 'REFEREE' },
        through: { attributes: [] },
        required: true,
      },
      { model: RefereeGroupUser, include: [RefereeGroup] },
    ],
  });
  if (!user) throw new ServiceError('user_not_found', 404);
  return user;
}

async function setUserGroup(userId, groupId, actorId) {
  const [user, group] = await Promise.all([
    User.findByPk(userId),
    RefereeGroup.findByPk(groupId),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!group) throw new ServiceError('referee_group_not_found', 404);
  let link = await RefereeGroupUser.findOne({ where: { user_id: userId } });
  if (link) {
    await link.update({ group_id: groupId, updated_by: actorId });
  } else {
    link = await RefereeGroupUser.create({
      user_id: userId,
      group_id: groupId,
      created_by: actorId,
      updated_by: actorId,
    });
  }
  return link;
}

async function removeUser(userId) {
  const link = await RefereeGroupUser.findOne({ where: { user_id: userId } });
  if (link) await link.destroy({ force: true });
}

async function remove(id) {
  const group = await RefereeGroup.findByPk(id);
  if (!group) throw new ServiceError('referee_group_not_found', 404);
  const userCount = await RefereeGroupUser.count({ where: { group_id: id } });
  if (userCount > 0) throw new ServiceError('referee_group_not_empty');
  await group.destroy();
}

export default {
  listAll,
  getById,
  create,
  update,
  addUser,
  listReferees,
  getReferee,
  setUserGroup,
  removeUser,
  remove,
};
