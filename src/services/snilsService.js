import { Op } from 'sequelize';

import { Snils } from '../models/index.js';

async function getByUser(userId) {
  return Snils.findOne({ where: { user_id: userId } });
}

async function create(userId, number, actorId) {
  const existing = await Snils.findOne({ where: { number } });
  if (existing) throw new Error('snils_exists');
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
  if (!snils) throw new Error('snils_not_found');
  if (duplicate) throw new Error('snils_exists');
  await snils.update({ number, updated_by: actorId });
  return snils;
}

async function remove(userId) {
  const snils = await Snils.findOne({ where: { user_id: userId } });
  if (!snils) throw new Error('snils_not_found');
  await snils.destroy();
}

export default { getByUser, create, update, remove };
