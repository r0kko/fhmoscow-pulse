import { Op } from 'sequelize';

import { Snils, UserExternalId } from '../models/index.js';
import legacyUserService from './legacyUserService.js';
import { isValidSnils } from '../utils/personal.js';

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

async function importFromLegacy(userId) {
  const existing = await Snils.findOne({ where: { user_id: userId } });
  if (existing) return existing;

  const ext = await UserExternalId.findOne({ where: { user_id: userId } });
  if (!ext) return null;

  const legacy = await legacyUserService.findById(ext.external_id);
  if (!legacy?.sv_ops) return null;

  const number = String(legacy.sv_ops);
  if (!isValidSnils(number)) return null;

  try {
    return await create(userId, number, userId);
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    return null;
  }
}

export default { getByUser, create, update, remove, importFromLegacy };
