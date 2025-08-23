import { Op } from 'sequelize';

import { Ground, Address } from '../models/index.js';
import { Stadium as ExtStadium } from '../externalModels/index.js';
import logger from '../../logger.js';
import ServiceError from '../errors/ServiceError.js';
import { statusFilters, ensureArchivedImported } from '../utils/sync.js';

import * as dadataService from './dadataService.js';

async function listAll(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  return Ground.findAndCountAll({
    include: [{ model: Address }],
    limit,
    offset,
    order: [['name', 'ASC']],
  });
}

async function getById(id) {
  const ground = await Ground.findByPk(id, {
    include: [{ model: Address }],
  });
  if (!ground) throw new ServiceError('ground_not_found', 404);
  return ground;
}

async function create(data, actorId) {
  let addressId = null;
  if (data.address?.result) {
    const cleaned = await dadataService.cleanAddress(data.address.result);
    const addrData = cleaned || { result: data.address.result };
    const address = await Address.create({
      ...addrData,
      created_by: actorId,
      updated_by: actorId,
    });
    addressId = address.id;
  }
  const ground = await Ground.create({
    name: data.name,
    address_id: addressId,
    yandex_url: data.yandex_url,
    created_by: actorId,
    updated_by: actorId,
  });
  return getById(ground.id);
}

async function update(id, data, actorId) {
  const ground = await Ground.findByPk(id, { include: [Address] });
  if (!ground) throw new ServiceError('ground_not_found', 404);
  if (data.address && typeof data.address.result === 'string') {
    const trimmed = data.address.result.trim();
    if (trimmed) {
      const cleaned = await dadataService.cleanAddress(trimmed);
      const addrData = cleaned || { result: trimmed };
      if (ground.Address) {
        await ground.Address.update({ ...addrData, updated_by: actorId });
      } else {
        const address = await Address.create({
          ...addrData,
          created_by: actorId,
          updated_by: actorId,
        });
        await ground.update({ address_id: address.id }, { returning: false });
      }
    } else if (ground.Address) {
      // Empty string means clear address
      await ground.Address.update({ updated_by: actorId });
      await ground.update({ address_id: null, updated_by: actorId });
      await ground.Address.destroy();
    }
  }
  await ground.update(
    {
      name: data.name ?? ground.name,
      yandex_url: data.yandex_url ?? ground.yandex_url,
      updated_by: actorId,
    },
    { returning: false }
  );
  return getById(id);
}

async function remove(id, actorId = null) {
  const ground = await Ground.findByPk(id, { include: [Address] });
  if (!ground) throw new ServiceError('ground_not_found', 404);
  if (ground.Address) {
    await ground.Address.update({ updated_by: actorId });
    await ground.Address.destroy();
  }
  await ground.update({ updated_by: actorId });
  await ground.destroy();
}

export default {
  listAll,
  getById,
  create,
  update,
  remove,
  async syncExternal(actorId = null) {
    // Preflight: ensure DB schema supports empty address and external_id
    try {
      const qi = Ground.sequelize?.getQueryInterface?.();
      if (qi?.describeTable) {
        const desc = await qi.describeTable('grounds').catch(() => null);
        if (!desc?.external_id) {
          logger.error(
            'Ground sync skipped: column "external_id" is missing. Run migration 20250920003000-add-external-id-to-grounds.js'
          );
          return {
            upserts: 0,
            softDeletedTotal: 0,
            softDeletedArchived: 0,
            softDeletedMissing: 0,
          };
        }
        if (desc?.address_id && desc.address_id.allowNull === false) {
          logger.error(
            'Ground sync skipped: "address_id" is NOT NULL. Run migration 20250920003000-add-external-id-to-grounds.js to allow NULL.'
          );
          return {
            upserts: 0,
            softDeletedTotal: 0,
            softDeletedArchived: 0,
            softDeletedMissing: 0,
          };
        }
      }
    } catch (e) {
      logger.error('Ground sync preflight failed: %s', e.stack || e);
    }

    // ACTIVE and ARCHIVE, tolerant to case/whitespace in external DB
    const { ACTIVE, ARCHIVE } = statusFilters('object_status');

    const [extActive, extArchived] = await Promise.all([
      ExtStadium.findAll({ where: ACTIVE }),
      ExtStadium.findAll({ where: ARCHIVE }),
    ]);
    const activeIds = extActive.map((s) => s.id);
    const archivedIds = extArchived.map((s) => s.id);
    const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

    let upserts = 0;
    let affectedArchived = 0;
    let affectedMissing = 0;

    await Ground.sequelize.transaction(async (tx) => {
      // Load existing grounds for known external IDs
      const locals = knownIds.length
        ? await Ground.findAll({
            where: { external_id: { [Op.in]: knownIds } },
            paranoid: false,
            transaction: tx,
          })
        : [];
      const localByExt = new Map(locals.map((g) => [g.external_id, g]));

      for (const s of extActive) {
        const existing = localByExt.get(s.id);
        if (!existing) {
          await Ground.create(
            {
              external_id: s.id,
              name: s.name,
              created_by: actorId,
              updated_by: actorId,
            },
            { transaction: tx }
          );
          upserts += 1;
          continue;
        }
        let changed = false;
        if (existing.deletedAt) {
          await existing.restore({ transaction: tx });
          changed = true;
        }
        const updates = {};
        if (existing.name !== s.name) updates.name = s.name;
        if (Object.keys(updates).length) {
          updates.updated_by = actorId;
          await existing.update(updates, { transaction: tx });
          changed = true;
        }
        if (changed) upserts += 1;
      }

      // Ensure archived external grounds exist locally (soft-deleted) to stabilize IDs
      await ensureArchivedImported(
        Ground,
        extArchived,
        (s) => ({ name: s.name }),
        actorId,
        tx
      );

      // Soft-delete explicitly archived
      const [archCnt] = await Ground.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
          transaction: tx,
          paranoid: false,
        }
      );
      affectedArchived = archCnt;

      // Soft-delete missing among known (not ACTIVE and not ARCHIVE)
      const [missCnt] = await Ground.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: knownIds, [Op.ne]: null },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      affectedMissing = missCnt;
    });

    const softDeletedTotal = affectedArchived + affectedMissing;
    logger.info(
      'Ground sync: upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
      upserts,
      softDeletedTotal,
      affectedArchived,
      affectedMissing
    );

    return {
      upserts,
      softDeletedTotal,
      softDeletedArchived: affectedArchived,
      softDeletedMissing: affectedMissing,
    };
  },
};
