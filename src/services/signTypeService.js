import { Op } from 'sequelize';

import { SignType, UserSignType, User, Role, Inn } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import emailVerificationService from './emailVerificationService.js';
import documentService from './documentService.js';

async function list() {
  const types = await SignType.findAll({ attributes: ['name', 'alias'] });
  return types;
}

async function getByUser(userId) {
  const record = await UserSignType.findOne({
    where: { user_id: userId },
    attributes: ['id', 'created_at'],
    include: [{ model: SignType, attributes: ['name', 'alias'] }],
  });
  if (!record) {
    return null;
  }
  const inn = await Inn.findOne({
    where: { user_id: userId },
    attributes: ['number'],
  });
  return {
    id: record.id,
    created_at: record.created_at,
    name: record.SignType.name,
    alias: record.SignType.alias,
    inn: inn ? inn.number : null,
  };
}

async function sendCode(user) {
  await emailVerificationService.sendCode(user, 'sign-type');
}

async function select(user, alias, code) {
  await emailVerificationService.verifyCode(user, code, 'ACTIVE');
  const signType = await SignType.findOne({ where: { alias } });
  if (!signType) {
    throw new ServiceError('sign_type_not_found', 404);
  }
  const [record] = await UserSignType.findOrCreate({
    where: { user_id: user.id },
    defaults: {
      user_id: user.id,
      sign_type_id: signType.id,
      created_by: user.id,
      updated_by: user.id,
    },
  });
  if (record.sign_type_id !== signType.id) {
    await record.update({ sign_type_id: signType.id, updated_by: user.id });
  }
  await documentService.generateInitial(user, signType.id);
  return signType;
}

async function listUsers() {
  const users = await User.findAll({
    attributes: ['id', 'last_name', 'first_name', 'patronymic', 'email'],
    include: [
      {
        model: Role,
        attributes: [],
        through: { attributes: [] },
        where: { alias: { [Op.in]: ['REFEREE', 'BRIGADE_REFEREE'] } },
      },
      {
        model: UserSignType,
        attributes: ['id'],
        required: false,
        include: [{ model: SignType, attributes: ['name', 'alias'] }],
      },
    ],
    order: [
      ['last_name', 'ASC'],
      ['first_name', 'ASC'],
    ],
  });

  return users.map((u) => ({
    id: u.id,
    lastName: u.last_name,
    firstName: u.first_name,
    patronymic: u.patronymic,
    email: u.email,
    signType:
      u.UserSignTypes[0] && u.UserSignTypes[0].SignType
        ? {
            name: u.UserSignTypes[0].SignType.name,
            alias: u.UserSignTypes[0].SignType.alias,
          }
        : null,
  }));
}

export default { list, getByUser, sendCode, select, listUsers };
