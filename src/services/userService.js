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
const MIN_BIRTH_DATE = new Date('1945-01-01');
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_ALL_BATCH_LIMIT = MAX_LIST_LIMIT;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  } else if (digits.length === 10) {
    digits = `7${digits}`;
  }
  return digits.slice(0, 11);
}

function isValidBirthDate(value) {
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return false;
  if (birth < MIN_BIRTH_DATE) return false;
  return birth <= new Date();
}

function normalizeUserPayload(data = {}) {
  const normalized = {
    ...data,
    first_name: normalizeText(data.first_name),
    last_name: normalizeText(data.last_name),
    patronymic: normalizeText(data.patronymic),
    phone: normalizePhone(data.phone),
    email: normalizeEmail(data.email),
    birth_date: normalizeText(data.birth_date),
  };
  return normalized;
}

function mapUniqueErrorToServiceCode(err) {
  const isUnique =
    err?.name === 'SequelizeUniqueConstraintError' ||
    err?.constructor?.name === 'UniqueConstraintError';
  if (!isUnique) return null;

  const fields = new Set(Object.keys(err?.fields || {}));
  for (const item of err?.errors || []) {
    if (item?.path) fields.add(item.path);
  }
  const context = `${String(err?.message || '')} ${String(
    err?.parent?.constraint || ''
  )}`.toLowerCase();

  if (fields.has('phone') || context.includes('users_phone_key')) {
    return 'phone_exists';
  }
  if (fields.has('email') || context.includes('users_email_key')) {
    return 'email_exists';
  }
  if (
    context.includes('uq_users_fullname_birth_date_active') ||
    fields.has('last_name') ||
    fields.has('first_name') ||
    fields.has('birth_date')
  ) {
    return 'user_exists';
  }
  return null;
}

async function createUser(data, actorId = null) {
  const normalized = normalizeUserPayload(data);
  if (!isValidBirthDate(normalized.birth_date)) {
    throw new ServiceError('invalid_birth_date');
  }
  if (!normalized.sex_id) {
    throw new ServiceError('sex_required');
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'password')) {
    assertPassword(normalized.password);
  }
  const sex = await Sex.findByPk(normalized.sex_id);
  if (!sex) throw new ServiceError('sex_not_found', 404);
  const activeStatus = await UserStatus.findOne({ where: { alias: 'ACTIVE' } });
  if (!activeStatus) throw new ServiceError('status_not_found', 404);

  const activeWhere = { deleted_at: null, status_id: activeStatus.id };

  const [phoneExisting, emailExisting, personalExisting] = await Promise.all([
    User.findOne({ where: { phone: normalized.phone } }),
    User.findOne({ where: { email: normalized.email } }),
    User.findOne({
      where: {
        last_name: normalized.last_name,
        first_name: normalized.first_name,
        patronymic: normalized.patronymic,
        birth_date: normalized.birth_date,
        ...activeWhere,
      },
    }),
  ]);
  if (phoneExisting) throw new ServiceError('phone_exists');
  if (emailExisting) throw new ServiceError('email_exists');
  if (personalExisting) throw new ServiceError('user_exists');

  try {
    return await User.create({
      ...normalized,
      status_id: activeStatus.id,
      created_by: actorId,
      updated_by: actorId,
    });
  } catch (err) {
    const code = mapUniqueErrorToServiceCode(err);
    if (code) throw new ServiceError(code);
    throw err;
  }
}

async function listUsers(options = {}) {
  const parsedPage = Number.parseInt(String(options.page || ''), 10);
  const parsedLimit = Number.parseInt(String(options.limit || ''), 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIST_LIMIT)
      : DEFAULT_LIST_LIMIT;
  const offset = (page - 1) * limit;

  const sortField = [
    'last_name',
    'first_name',
    'email',
    'phone',
    'birth_date',
    'createdAt',
    'status',
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
      { patronymic: { [Op.iLike]: term } },
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

  const order =
    sortField === 'status'
      ? [
          [{ model: UserStatus }, 'alias', sortOrder],
          ['last_name', 'ASC'],
          ['first_name', 'ASC'],
          ['id', 'ASC'],
        ]
      : [
          [sortField, sortOrder],
          ['id', 'ASC'],
        ];

  return User.findAndCountAll({
    include,
    where,
    order,
    distinct: true,
    subQuery: false,
    limit,
    offset,
  });
}

async function listUsersAll(options = {}) {
  const parsedBatchLimit = Number.parseInt(
    String(options.batchLimit || ''),
    10
  );
  const batchLimit =
    Number.isFinite(parsedBatchLimit) && parsedBatchLimit > 0
      ? Math.min(parsedBatchLimit, MAX_LIST_LIMIT)
      : DEFAULT_LIST_ALL_BATCH_LIMIT;

  const firstPage = await listUsers({
    ...options,
    page: 1,
    limit: batchLimit,
  });
  const rows = [...(firstPage.rows || [])];
  const count = Number(firstPage.count || 0);
  const pages = Math.max(1, Math.ceil(count / Math.max(batchLimit, 1)));
  const seenIds = new Set(rows.map((row) => row?.id).filter(Boolean));

  for (let currentPage = 2; currentPage <= pages; currentPage += 1) {
    const pageResult = await listUsers({
      ...options,
      page: currentPage,
      limit: batchLimit,
    });
    const pageRows = pageResult.rows || [];
    if (!pageRows.length) break;
    for (const row of pageRows) {
      if (!row?.id || seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      rows.push(row);
    }
  }

  return { rows, count };
}

async function getUser(id) {
  const user = await User.findByPk(id, { include: [Role, UserStatus, Sex] });
  if (!user) throw new ServiceError('user_not_found', 404);
  return user;
}

async function updateUser(id, data, actorId = null) {
  const user = await User.findByPk(id);
  if (!user) throw new ServiceError('user_not_found', 404);
  const normalized = {
    ...data,
    ...(Object.prototype.hasOwnProperty.call(data, 'first_name')
      ? { first_name: normalizeText(data.first_name) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(data, 'last_name')
      ? { last_name: normalizeText(data.last_name) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(data, 'patronymic')
      ? { patronymic: normalizeText(data.patronymic) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(data, 'phone')
      ? { phone: normalizePhone(data.phone) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(data, 'email')
      ? { email: normalizeEmail(data.email) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(data, 'birth_date')
      ? { birth_date: normalizeText(data.birth_date) }
      : {}),
  };
  if (Object.prototype.hasOwnProperty.call(normalized, 'sex_id')) {
    if (!normalized.sex_id) {
      throw new ServiceError('sex_required');
    }
    const sex = await Sex.findByPk(normalized.sex_id);
    if (!sex) throw new ServiceError('sex_not_found', 404);
  }
  if (
    Object.prototype.hasOwnProperty.call(normalized, 'birth_date') &&
    !isValidBirthDate(normalized.birth_date)
  ) {
    throw new ServiceError('invalid_birth_date');
  }
  try {
    await user.update({ ...normalized, updated_by: actorId });
  } catch (err) {
    const code = mapUniqueErrorToServiceCode(err);
    if (code) throw new ServiceError(code);
    throw err;
  }
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

async function setTemporaryPassword(id, password, actorId = null) {
  const user = await User.scope('withPassword').findByPk(id);
  if (!user) throw new ServiceError('user_not_found', 404);
  assertPassword(password);
  user.password = password;
  user.password_change_required = true;
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
  listUsersAll,
  getUser,
  createUser,
  updateUser,
  setStatus,
  resetPassword,
  assignRole,
  removeRole,
  bumpTokenVersion,
  setTemporaryPassword,
};
