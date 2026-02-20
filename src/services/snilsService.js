import { Op } from 'sequelize';

import { Snils, UserExternalId } from '../models/index.js';
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
  const map = await hasAnySnilsBulk([userId]);
  return map.get(String(userId)) === true;
}

export async function hasAnySnilsBulk(userIds) {
  const ids = Array.from(
    new Set((Array.isArray(userIds) ? userIds : []).map((id) => String(id)))
  ).filter(Boolean);

  const result = new Map(ids.map((id) => [id, false]));
  if (!ids.length) return result;

  const localRows = await Snils.findAll({
    where: { user_id: { [Op.in]: ids } },
    attributes: ['user_id'],
  });
  const localSet = new Set(localRows.map((row) => String(row.user_id)));
  for (const id of localSet) {
    result.set(id, true);
  }

  const missing = ids.filter((id) => !localSet.has(id));
  if (!missing.length) return result;

  let extRows = [];
  try {
    extRows = await UserExternalId.findAll({
      where: { user_id: { [Op.in]: missing } },
      attributes: ['user_id', 'external_id'],
    });
  } catch (_e) {
    return result;
  }

  const externalIdByUser = new Map();
  for (const row of extRows) {
    const userId = String(row.user_id || '');
    const externalId = String(row.external_id || '').trim();
    if (userId && externalId && !externalIdByUser.has(userId)) {
      externalIdByUser.set(userId, externalId);
    }
  }

  const externalIds = Array.from(new Set(externalIdByUser.values()));
  if (!externalIds.length) return result;

  const legacyRows = await legacyService.findByIds(externalIds);
  const legacyById = new Map(
    legacyRows.map((row) => [String(row?.id || ''), Boolean(row?.sv_ops)])
  );

  for (const [userId, externalId] of externalIdByUser.entries()) {
    if (legacyById.get(externalId) === true) {
      result.set(userId, true);
    }
  }

  return result;
}
