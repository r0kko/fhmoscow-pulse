import { Op } from 'sequelize';

import { Snils } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function getByUser(userId) {
  return Snils.findOne({ where: { user_id: userId } });
}

async function create(userId, number, actorId) {
  const existing = await Snils.findOne({ where: { number } });
  if (existing) throw new ServiceError('snils_exists');
  return Snils.create({
    user_id: userId,
    number,
    created_by: actorId,
    updated_by: actorId,
  });
}

async function update(userId, number, actorId) {
  const [snils, duplicate] = await Promise.all([
    Snils.findOne({ where: { user_id: userId } }),
    Snils.findOne({
      where: { number, user_id: { [Op.ne]: userId } },
    }),
  ]);
  if (!snils) throw new ServiceError('snils_not_found', 404);
  if (duplicate) throw new ServiceError('snils_exists');
  await snils.update({ number, updated_by: actorId });
  return snils;
}

async function remove(userId, actorId = null) {
  const snils = await Snils.findOne({ where: { user_id: userId } });
  if (!snils) throw new ServiceError('snils_not_found', 404);
  await snils.update({ updated_by: actorId });
  await snils.destroy();
}

export default { getByUser, create, update, remove };
