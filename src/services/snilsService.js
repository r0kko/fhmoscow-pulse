import { Op } from 'sequelize';

import { Snils } from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

import legacyService from './legacyUserService.js';

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

// Presence helper used by multiple modules to ensure consistent logic across UI screens
export async function hasAnySnils(userId) {
  // 1) Local record exists
  const local = await Snils.findOne({ where: { user_id: userId } });
  if (local) return true;
  // 2) Fallback to legacy field if available (no validation, presence-only)
  try {
    const { UserExternalId } = await import('../models/index.js');
    const ext = await UserExternalId.findOne({ where: { user_id: userId } });
    if (!ext) return false;
    const legacy = await legacyService.findById(ext.external_id);
    return Boolean(legacy?.sv_ops);
  } catch (_e) {
    return false;
  }
}
