import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';
import {
  NormativeResult,
  NormativeType,
  NormativeTypeZone,
  NormativeGroupType,
  NormativeGroup,
  NormativeZone,
  Training,
  CampStadium,
  Season,
  User,
  MeasurementUnit,
  TrainingRegistration,
  TrainingRole,
} from '../models/index.js';

import { parseResultValue, determineZone } from './normativeTypeService.js';
import emailService from './emailService.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 15, 10));
  const offset = (page - 1) * limit;
  const where = {};
  if (options.season_id) where.season_id = options.season_id;
  if (options.user_id) where.user_id = options.user_id;
  if (options.training_id) where.training_id = options.training_id;
  const include = [
    {
      model: User,
      attributes: ['id', 'last_name', 'first_name', 'patronymic'],
    },
    { model: Training, include: [CampStadium] },
    {
      model: NormativeType,
      include: [{ model: NormativeGroupType, include: [NormativeGroup] }],
    },
    { model: NormativeZone },
  ];
  if (options.search) {
    const term = `%${options.search}%`;
    include[0].where = {
      [Op.or]: [
        { last_name: { [Op.iLike]: term } },
        { first_name: { [Op.iLike]: term } },
        { patronymic: { [Op.iLike]: term } },
      ],
    };
    include[0].required = true;
  }
  if (options.type_id) {
    include[2].where = { id: options.type_id };
    include[2].required = true;
  }
  if (options.group_id) {
    include[2].include[0].where = { group_id: options.group_id };
    include[2].include[0].required = true;
    include[2].required = true;
  }
  const { rows, count } = await NormativeResult.findAndCountAll({
    order: [['created_at', 'DESC']],
    limit,
    offset,
    where,
    include,
  });
  for (const r of rows) {
    const group =
      r.NormativeType?.NormativeGroupTypes?.[0]?.NormativeGroup || null;
    if (group) r.setDataValue('group', group);
    if (r.NormativeZone) r.setDataValue('zone', r.NormativeZone);
  }
  return { rows, count };
}

async function getById(id) {
  const res = await NormativeResult.findByPk(id, {
    include: [
      {
        model: User,
        attributes: ['id', 'last_name', 'first_name', 'patronymic'],
      },
      { model: Training, include: [CampStadium] },
      {
        model: NormativeType,
        include: [
          { model: MeasurementUnit },
          { model: NormativeGroupType, include: [NormativeGroup] },
        ],
      },
      { model: NormativeZone },
    ],
  });
  if (!res) throw new ServiceError('normative_result_not_found', 404);
  const group =
    res.NormativeType?.NormativeGroupTypes?.[0]?.NormativeGroup || null;
  if (group) res.setDataValue('group', group);
  if (res.NormativeZone) res.setDataValue('zone', res.NormativeZone);
  return res;
}

async function create(data, actorId) {
  const [user, season, type] = await Promise.all([
    User.findByPk(data.user_id),
    Season.findByPk(data.season_id),
    NormativeType.findByPk(data.type_id, {
      include: [MeasurementUnit, NormativeTypeZone],
    }),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!season) throw new ServiceError('season_not_found', 404);
  if (!type) throw new ServiceError('normative_type_not_found', 404);
  if (type.season_id !== data.season_id) {
    throw new ServiceError('normative_type_invalid_season');
  }
  if (data.training_id) {
    const registration = await TrainingRegistration.findOne({
      where: { training_id: data.training_id, user_id: data.user_id },
      paranoid: false,
    });
    const role = await TrainingRole.findOne({
      where: { alias: 'PARTICIPANT' },
    });
    if (!role) throw new ServiceError('training_role_not_found');
    if (registration) {
      if (registration.deletedAt) {
        await registration.restore();
      }
      await registration.update({
        training_role_id: role.id,
        present: true,
        updated_by: actorId,
      });
    } else {
      await TrainingRegistration.create({
        training_id: data.training_id,
        user_id: data.user_id,
        training_role_id: role.id,
        present: true,
        created_by: actorId,
        updated_by: actorId,
      });
    }
  }
  const value = parseResultValue(data.value, type.MeasurementUnit);
  if (value == null) throw new ServiceError('invalid_value');
  const zone = determineZone(type, value, user.sex_id);
  const res = await NormativeResult.create({
    user_id: data.user_id,
    season_id: data.season_id,
    training_id: data.training_id,
    type_id: data.type_id,
    value_type_id: type.value_type_id,
    unit_id: type.unit_id,
    zone_id: zone?.zone_id || null,
    online: Boolean(data.online),
    retake: false,
    value,
    created_by: actorId,
    updated_by: actorId,
  });
  const created = await getById(res.id);
  await emailService.sendNormativeResultAddedEmail(user, created);
  return created;
}

async function update(id, data, actorId) {
  const res = await NormativeResult.findByPk(id, {
    include: [
      {
        model: NormativeType,
        include: [MeasurementUnit, NormativeTypeZone],
      },
      { model: User },
    ],
  });
  if (!res) throw new ServiceError('normative_result_not_found', 404);
  let newValue = res.value;
  if (Object.hasOwn(data, 'value')) {
    newValue = parseResultValue(data.value, res.NormativeType.MeasurementUnit);
    if (newValue == null) throw new ServiceError('invalid_value');
  }
  const zone = determineZone(res.NormativeType, newValue, res.User?.sex_id);
  await res.update(
    {
      training_id: data.training_id ?? res.training_id,
      value: newValue,
      zone_id: zone?.zone_id || null,
      online: false,
      retake: false,
      updated_by: actorId,
    },
    { returning: false }
  );
  const updated = await getById(res.id);
  const user = res.User || (await User.findByPk(res.user_id));
  if (user) {
    await emailService.sendNormativeResultUpdatedEmail(user, updated);
  }
  return updated;
}

async function remove(id, actorId = null) {
  const res = await getById(id);
  if (!res) throw new ServiceError('normative_result_not_found', 404);
  await res.update({ updated_by: actorId });
  await res.destroy();
  let user = res.User;
  if (!user || !user.email) {
    user = await User.findByPk(res.user_id);
  }
  if (user && user.email) {
    await emailService.sendNormativeResultRemovedEmail(user, res);
  }
}

async function countByTraining(trainingId) {
  const rows = await NormativeResult.findAll({
    attributes: ['user_id', [sequelize.fn('COUNT', sequelize.col('*')), 'cnt']],
    where: { training_id: trainingId },
    group: ['user_id'],
    raw: true,
  });
  const map = {};
  for (const r of rows) {
    map[r.user_id] = parseInt(r.cnt, 10);
  }
  return map;
}

async function listSeasonsForUser(userId) {
  const ids = await NormativeResult.findAll({
    attributes: ['season_id'],
    where: { user_id: userId },
    group: ['season_id'],
    raw: true,
  }).then((rows) => rows.map((r) => r.season_id));
  if (!ids.length) return [];
  return Season.findAll({ where: { id: ids }, order: [['name', 'ASC']] });
}

export default {
  listAll,
  getById,
  create,
  update,
  remove,
  listSeasonsForUser,
  countByTraining,
};
