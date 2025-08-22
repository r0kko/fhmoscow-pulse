import { Op, fn, col, where } from 'sequelize';

import { Ground, Address } from '../models/index.js';
import { Stadium as ExtStadium } from '../externalModels/index.js';
import logger from '../../logger.js';
import ServiceError from '../errors/ServiceError.js';

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
    const ACTIVE = where(
      fn('LOWER', fn('TRIM', col('object_status'))),
      'active'
    );
    const ARCHIVE = where(
      fn('LOWER', fn('TRIM', col('object_status'))),
      'archive'
    );

    const [extActive, extArchived] = await Promise.all([
      ExtStadium.findAll({ where: ACTIVE }),
      ExtStadium.findAll({ where: ARCHIVE }),
    ]);
    const activeIds = extActive.map((s) => s.id);
    const archivedIds = extArchived.map((s) => s.id);

    let upserts = 0;
    let affectedArchived = 0;
    let affectedMissing = 0;

    await Ground.sequelize.transaction(async (tx) => {
      for (const s of extActive) {
        const existing = await Ground.findOne({
          where: { external_id: s.id },
          paranoid: false,
          transaction: tx,
        });
        if (existing) {
          await existing.update(
            { name: s.name, deleted_at: null, updated_by: actorId },
            { transaction: tx }
          );
        } else {
          // Minimal import: external_id + name, address left empty for manual fill
          await Ground.create(
            {
              external_id: s.id,
              name: s.name,
              created_by: actorId,
              updated_by: actorId,
            },
            { transaction: tx }
          );
        }
        upserts += 1;
      }

      // Soft-delete explicitly archived
      const [archCnt] = await Ground.update(
        { deleted_at: new Date(), updated_by: actorId },
        { where: { external_id: { [Op.in]: archivedIds } }, transaction: tx }
      );
      affectedArchived = archCnt;

      // Soft-delete missing among active (previously synced only)
      const [missCnt] = await Ground.update(
        { deleted_at: new Date(), updated_by: actorId },
        {
          where: { external_id: { [Op.notIn]: activeIds, [Op.ne]: null } },
          transaction: tx,
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
