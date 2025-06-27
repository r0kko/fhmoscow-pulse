import { Op } from 'sequelize';

import { User, Role, UserStatus } from '../models/index.js';

async function createUser(data) {
  const [activeStatus, unconfirmedStatus] = await Promise.all([
    UserStatus.findOne({ where: { alias: 'ACTIVE' } }),
    UserStatus.findOne({ where: { alias: 'EMAIL_UNCONFIRMED' } }),
  ]);

  const activeWhere = { deleted_at: null, status_id: activeStatus.id };

  const [phoneExisting, emailExisting, personalExisting] = await Promise.all([
    User.findOne({ where: { phone: data.phone, ...activeWhere } }),
    User.findOne({ where: { email: data.email, ...activeWhere } }),
    User.findOne({
      where: {
        last_name: data.last_name,
        first_name: data.first_name,
        patronymic: data.patronymic,
        birth_date: data.birth_date,
        ...activeWhere,
      },
    }),
  ]);
  if (phoneExisting) throw new Error('phone_exists');
  if (emailExisting) throw new Error('email_exists');
  if (personalExisting) throw new Error('user_exists');

  const status = unconfirmedStatus || activeStatus;
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
  const include = [Role];
  if (options.status) {
    include.push({
      model: UserStatus,
      where: { alias: options.status },
      required: true,
    });
  } else {
    include.push(UserStatus);
  }

  return User.findAndCountAll({
    include,
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
