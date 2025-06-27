import { Op } from 'sequelize';

import { Inn, UserExternalId } from '../models/index.js';
import { isValidInn } from '../utils/personal.js';

import taxationService from './taxationService.js';
import legacyUserService from './legacyUserService.js';

async function getByUser(userId) {
  return Inn.findOne({ where: { user_id: userId } });
}

async function create(userId, number, actorId) {
  const existing = await Inn.findOne({ where: { number } });
  if (existing) throw new Error('inn_exists');
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
  if (!inn) throw new Error('inn_not_found');
  if (duplicate) throw new Error('inn_exists');
  await inn.update({ number, updated_by: actorId });
  return inn;
}

async function remove(userId) {
  const inn = await Inn.findOne({ where: { user_id: userId } });
  if (!inn) throw new Error('inn_not_found');
  await inn.destroy();
  await taxationService.removeByUser(userId);
}

async function importFromLegacy(userId) {
  const existing = await Inn.findOne({ where: { user_id: userId } });
  if (existing) return existing;

  const ext = await UserExternalId.findOne({ where: { user_id: userId } });
  if (!ext) return null;

  const legacy = await legacyUserService.findById(ext.external_id);
  if (!legacy?.sv_inn) return null;

  const number = String(legacy.sv_inn).replace(/\D/g, '');
  if (!isValidInn(number)) return null;

  try {
    return await create(userId, number, userId);
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    return null;
  }
}

export default { getByUser, create, update, remove, importFromLegacy };
