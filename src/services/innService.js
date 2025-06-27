import { Op } from 'sequelize';

import { Inn } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import taxationService from './taxationService.js';

async function getByUser(userId) {
  return Inn.findOne({ where: { user_id: userId } });
}

async function create(userId, number, actorId) {
  const existing = await Inn.findOne({ where: { number } });
  if (existing) throw new ServiceError('inn_exists');
  const inn = await Inn.create({
    user_id: userId,
    number,
    created_by: actorId,
    updated_by: actorId,
  });
  return inn;
}

async function update(userId, number, actorId) {
  const [inn, duplicate] = await Promise.all([
    Inn.findOne({ where: { user_id: userId } }),
    Inn.findOne({
      where: { number, user_id: { [Op.ne]: userId } },
    }),
  ]);
  if (!inn) throw new ServiceError('inn_not_found', 404);
  if (duplicate) throw new ServiceError('inn_exists');
  await inn.update({ number, updated_by: actorId });
  return inn;
}

async function remove(userId) {
  const inn = await Inn.findOne({ where: { user_id: userId } });
  if (!inn) throw new ServiceError('inn_not_found', 404);
  await inn.destroy();
  await taxationService.removeByUser(userId);
}

export default { getByUser, create, update, remove };
