import { Inn } from '../models/index.js';

import taxationService from './taxationService.js';

async function getByUser(userId) {
  return Inn.findOne({ where: { user_id: userId } });
}

async function create(userId, number, actorId) {
  const inn = await Inn.create({
    user_id: userId,
    number,
    created_by: actorId,
    updated_by: actorId,
  });
  return inn;
}

async function update(userId, number, actorId) {
  const inn = await Inn.findOne({ where: { user_id: userId } });
  if (!inn) throw new Error('inn_not_found');
  await inn.update({ number, updated_by: actorId });
  return inn;
}

async function remove(userId) {
  const inn = await Inn.findOne({ where: { user_id: userId } });
  if (!inn) throw new Error('inn_not_found');
  await inn.destroy();
  await taxationService.removeByUser(userId);
}

export default { getByUser, create, update, remove };
