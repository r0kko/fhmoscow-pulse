import { Op } from 'sequelize';

import { Club } from '../models/index.js';
import { Club as ExtClub } from '../externalModels/index.js';
import sequelize from '../config/database.js';
import {
  statusFilters,
  ensureArchivedImported,
  buildSinceClause,
  maxTimestamp,
  normalizeSyncOptions,
} from '../utils/sync.js';
import logger from '../../logger.js';

async function syncExternal(options = {}) {
  const { actorId, mode, since, fullResync } = normalizeSyncOptions(options);

  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const sinceClause = buildSinceClause(since);

  const attributes = ['id', 'short_name', 'date_update', 'date_create'];
  const activeWhere = fullResync ? ACTIVE : { [Op.and]: [ACTIVE, sinceClause] };
  const archiveWhere = fullResync
    ? ARCHIVE
    : { [Op.and]: [ARCHIVE, sinceClause] };

  let [extActive, extArchived] = await Promise.all([
    ExtClub.findAll({ where: activeWhere, attributes }),
    ExtClub.findAll({ where: archiveWhere, attributes }),
  ]);

  if (fullResync && extActive.length === 0 && extArchived.length === 0) {
    extActive = await ExtClub.findAll({ attributes });
    extArchived = [];
  }

  const activeIds = extActive.map((c) => c.id);
  const archivedIds = extArchived.map((c) => c.id);
  const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

  let upserts = 0;
  let affectedArchived = 0;
  let affectedMissing = 0;

  if (knownIds.length) {
    await sequelize.transaction(async (tx) => {
      const locals = await Club.findAll({
        where: { external_id: { [Op.in]: knownIds } },
        paranoid: false,
        transaction: tx,
      });
      const localByExt = new Map(locals.map((l) => [l.external_id, l]));

      for (const c of extActive) {
        const local = localByExt.get(c.id);
        if (!local) {
          await Club.create(
            {
              external_id: c.id,
              name: c.short_name,
              created_by: actorId,
              updated_by: actorId,
            },
            { transaction: tx }
          );
          upserts += 1;
          continue;
        }
        let changed = false;
        if (local.deletedAt) {
          await local.restore({ transaction: tx });
          changed = true;
        }
        const updates = {};
        if (local.name !== c.short_name) updates.name = c.short_name;
        if (Object.keys(updates).length) {
          updates.updated_by = actorId;
          await local.update(updates, { transaction: tx });
          changed = true;
        }
        if (changed) upserts += 1;
      }

      if (extArchived.length) {
        await ensureArchivedImported(
          Club,
          extArchived,
          (c) => ({ name: c.short_name }),
          actorId,
          tx
        );
      }

      if (archivedIds.length) {
        const [archCnt] = await Club.update(
          { deletedAt: new Date(), updated_by: actorId },
          {
            where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
            transaction: tx,
            paranoid: false,
          }
        );
        affectedArchived = archCnt;
      }

      if (fullResync) {
        const [missCnt] = await Club.update(
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
      }
    });
  } else if (fullResync) {
    // Full run with zero known ids → sweep all local records as missing
    const [missCnt] = await Club.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { deletedAt: null, external_id: { [Op.ne]: null } },
        paranoid: false,
      }
    );
    affectedMissing = missCnt;
  }

  const softDeletedTotal = affectedArchived + affectedMissing;
  const cursor = maxTimestamp([...extActive, ...extArchived]);
  logger.info(
    'Club sync (mode=%s): upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
    mode,
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
    cursor,
    mode,
    fullSync: fullResync,
  };
}

async function listAll() {
  return Club.findAll({ order: [['name', 'ASC']] });
}

/**
 * Paginated list with optional search and eager-loaded teams.
 * @param {Object} options
 * @param {number} [options.page]
 * @param {number} [options.limit]
 * @param {string} [options.search]
 * @param {boolean} [options.includeTeams]
 * @param {boolean} [options.includeGrounds]
 */
async function list(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const where = {};
  if (options.search) {
    const term = `%${options.search}%`;
    where.name = { [Op.iLike]: term };
  }
  const include = [];
  if (options.includeTeams) {
    const { Team } = await import('../models/index.js');
    include.push({ model: Team, required: false });
  }
  if (options.includeGrounds) {
    const { Ground } = await import('../models/index.js');
    include.push({ model: Ground, required: false });
  }
  return Club.findAndCountAll({
    where,
    include,
    order: [['name', 'ASC']],
    limit,
    offset,
    distinct: true,
  });
}

export default { syncExternal, listAll, list };
