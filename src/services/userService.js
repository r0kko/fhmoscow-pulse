import { User, Role, UserStatus } from '../models/index.js';

async function createUser(data) {
  const status = await UserStatus.findOne({ where: { alias: 'ACTIVE' } });
  const user = await User.create({ ...data, status_id: status.id });
  return user;
}

async function listUsers() {
  return User.findAll({ include: [Role, UserStatus] });
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
