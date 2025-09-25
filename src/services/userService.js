import { Op, literal } from 'sequelize';

import {
  Role,
  Sex,
  User,
  UserRole,
  UserStatus,
  UserCourse,
  Course,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import { assertPassword } from '../utils/passwordPolicy.js';
import { FHMO_STAFF_ROLES } from '../utils/roles.js';

const FHMO_ROLE_SET = new Set(FHMO_STAFF_ROLES);

async function createUser(data, actorId = null) {
  const birth = new Date(data.birth_date);
  if (Number.isNaN(birth.getTime()) || birth < new Date('1945-01-01')) {
    throw new ServiceError('invalid_birth_date');
  }
  if (!data.sex_id) {
    throw new ServiceError('sex_required');
  }
  if (Object.prototype.hasOwnProperty.call(data, 'password')) {
    assertPassword(data.password);
  }
  const sex = await Sex.findByPk(data.sex_id);
  if (!sex) throw new ServiceError('sex_not_found', 404);
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
  if (phoneExisting) throw new ServiceError('phone_exists');
  if (emailExisting) throw new ServiceError('email_exists');
  if (personalExisting) throw new ServiceError('user_exists');

  const status = unconfirmedStatus || activeStatus;
  return await User.create({
    ...data,
    status_id: status.id,
    created_by: actorId,
    updated_by: actorId,
  });
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
  const include = [];
  if (
    options.role &&
    (Array.isArray(options.role) ? options.role.length : true)
  ) {
    const aliases = Array.isArray(options.role) ? options.role : [options.role];
    if (aliases.length === 1 && aliases[0] === 'NO_ROLE') {
      // Users without any roles:
      // Use NOT EXISTS against the join table to avoid alias issues
      include.push({
        model: Role,
        required: false,
        through: { attributes: [] },
      });
      const noRoleCondition = literal(
        'NOT EXISTS (SELECT 1 FROM "user_roles" ur WHERE ur.user_id = "User"."id" AND ur.deleted_at IS NULL)'
      );
      if (!where[Op.and]) where[Op.and] = [];
      where[Op.and].push(noRoleCondition);
    } else {
      include.push({
        model: Role,
        where: { alias: aliases },
        required: true,
        through: { attributes: [] },
      });
    }
  } else {
    include.push({ model: Role, through: { attributes: [] } });
  }
  if (options.status) {
    include.push({
      model: UserStatus,
      where: { alias: options.status },
      required: true,
    });
  } else {
    include.push(UserStatus);
  }
  include.push(Sex);
  if (options.includeCourse) {
    include.push({ model: UserCourse, include: [Course], required: false });
  }

  return User.findAndCountAll({
    include,
    where,
    order: [[sortField, sortOrder]],
    distinct: true,
    subQuery: false,
    limit,
    offset,
  });
}

async function getUser(id) {
  const user = await User.findByPk(id, { include: [Role, UserStatus, Sex] });
  if (!user) throw new ServiceError('user_not_found', 404);
  return user;
}

async function updateUser(id, data, actorId = null) {
  const user = await User.findByPk(id);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (Object.prototype.hasOwnProperty.call(data, 'sex_id')) {
    if (!data.sex_id) {
      throw new ServiceError('sex_required');
    }
    const sex = await Sex.findByPk(data.sex_id);
    if (!sex) throw new ServiceError('sex_not_found', 404);
  }
  await user.update({ ...data, updated_by: actorId });
  return user;
}

async function setStatus(id, alias, actorId = null) {
  const [user, status] = await Promise.all([
    User.findByPk(id),
    UserStatus.findOne({ where: { alias } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!status) throw new ServiceError('status_not_found', 404);
  await user.update({ status_id: status.id, updated_by: actorId });
  return user;
}

async function resetPassword(id, password, actorId = null) {
  const user = await User.scope('withPassword').findByPk(id);
  if (!user) throw new ServiceError('user_not_found', 404);
  assertPassword(password);
  user.password = password;
  user.updated_by = actorId;
  await user.save();
  return user;
}

async function bumpTokenVersion(id) {
  const user = await User.findByPk(id);
  if (!user) throw new ServiceError('user_not_found', 404);
  await user.increment('token_version');
  return user.reload();
}

async function assignRole(userId, alias, actorId = null) {
  const [user, role] = await Promise.all([
    User.findByPk(userId),
    Role.findOne({ where: { alias } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!role) throw new ServiceError('role_not_found', 404);

  if (FHMO_ROLE_SET.has(alias)) {
    const fhmoRoles = await user.getRoles({
      where: { alias: FHMO_STAFF_ROLES },
    });
    await Promise.all(
      fhmoRoles
        .filter((fhmoRole) => fhmoRole.alias !== alias)
        .map(async (fhmoRole) => {
          const link = await UserRole.findOne({
            where: { user_id: userId, role_id: fhmoRole.id },
            paranoid: false,
          });
          if (link) {
            await link.update({ updated_by: actorId });
          }
          await user.removeRole(fhmoRole);
        })
    );
  }

  const existing = await UserRole.findOne({
    where: { user_id: userId, role_id: role.id },
    paranoid: false,
  });

  if (existing) {
    if (existing.deletedAt) {
      await existing.restore();
      await existing.update({ updated_by: actorId });
    }
    return user;
  }

  await user.addRole(role, {
    through: { created_by: actorId, updated_by: actorId },
  });
  return user;
}

async function removeRole(userId, alias, actorId = null) {
  const [user, role] = await Promise.all([
    User.findByPk(userId),
    Role.findOne({ where: { alias } }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!role) throw new ServiceError('role_not_found', 404);
  const link = await UserRole.findOne({
    where: { user_id: userId, role_id: role.id },
  });
  if (link) {
    await link.update({ updated_by: actorId });
  }
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
  bumpTokenVersion,
};
