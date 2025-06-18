import { Op } from 'sequelize';

import { User, Role, UserStatus } from '../models/index.js';

async function createUser(data) {
  const status = await UserStatus.findOne({ where: { alias: 'ACTIVE' } });
  const user = await User.create({ ...data, status_id: status.id });
  return user;
}

async function listUsers(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1));
  const limit = Math.max(1, parseInt(options.limit || 20));
  const offset = (page - 1) * limit;

  const sortField = [
    'last_name',
    'first_name',
    'email',
    'phone',
    'birth_date',
    'createdAt',
  ].includes(options.sort)
    ? options.sort
    : 'last_name';
  const sortOrder = options.order === 'desc' ? 'DESC' : 'ASC';

  const where = {};
  if (options.search) {
    const term = `%${options.search}%`;
    where[Op.or] = [
      { last_name: { [Op.iLike]: term } },
      { first_name: { [Op.iLike]: term } },
      { phone: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
    ];
  }

  return User.findAndCountAll({
    include: [Role, UserStatus],
    where,
    order: [[sortField, sortOrder]],
    limit,
    offset,
  });
}

async function getUser(id) {
  const user = await User.findByPk(id, { include: [Role, UserStatus] });
  if (!user) throw new Error('user_not_found');
  return user;
}

async function updateUser(id, data) {
  const user = await User.findByPk(id);
  if (!user) throw new Error('user_not_found');
  await user.update(data);
  return user;
}

async function setStatus(id, alias) {
  const [user, status] = await Promise.all([
    User.findByPk(id),
    UserStatus.findOne({ where: { alias } }),
  ]);
  if (!user) throw new Error('user_not_found');
  if (!status) throw new Error('status_not_found');
  await user.update({ status_id: status.id });
  return user;
}

async function resetPassword(id, password) {
  const user = await User.scope('withPassword').findByPk(id);
  if (!user) throw new Error('user_not_found');
  user.password = password;
  await user.save();
  return user;
}

async function assignRole(userId, alias) {
  const [user, role] = await Promise.all([
    User.findByPk(userId),
    Role.findOne({ where: { alias } }),
  ]);
  if (!user) throw new Error('user_not_found');
  if (!role) throw new Error('role_not_found');
  await user.addRole(role);
  return user;
}

async function removeRole(userId, alias) {
  const [user, role] = await Promise.all([
    User.findByPk(userId),
    Role.findOne({ where: { alias } }),
  ]);
  if (!user) throw new Error('user_not_found');
  if (!role) throw new Error('role_not_found');
  await user.removeRole(role);
  return user;
}

export default {
  listUsers,
  getUser,
  createUser,
  updateUser,
  setStatus,
  resetPassword,
  assignRole,
  removeRole,
};
