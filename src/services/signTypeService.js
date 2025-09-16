import { Op } from 'sequelize';

import { Inn, Role, SignType, User, UserSignType } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import emailVerificationService from './emailVerificationService.js';
import documentService from './documentService.js';

async function list() {
  return await SignType.findAll({
    attributes: ['id', 'name', 'alias'],
  });
}

async function getByUser(userId) {
  const record = await UserSignType.findOne({
    where: { user_id: userId },
    attributes: ['id', 'created_at', 'sign_created_date'],
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
    selectedAt: record.created_at,
    signCreatedDate: record.sign_created_date,
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
  await UserSignType.destroy({ where: { user_id: user.id } });
  await UserSignType.create({
    user_id: user.id,
    sign_type_id: signType.id,
    sign_created_date: new Date(),
    created_by: user.id,
    updated_by: user.id,
  });
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
      { model: Inn, attributes: ['number'], required: false },
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
    inn: u.Inn ? u.Inn.number : null,
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
