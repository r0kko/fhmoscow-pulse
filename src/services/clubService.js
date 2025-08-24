import { Op } from 'sequelize';

import { Club } from '../models/index.js';
import { Club as ExtClub } from '../externalModels/index.js';
import sequelize from '../config/database.js';
import { statusFilters, ensureArchivedImported } from '../utils/sync.js';
import logger from '../../logger.js';

async function syncExternal(actorId = null) {
  // Pull ACTIVE and ARCHIVE sets explicitly; tolerant to case/whitespace
  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const [extActive, extArchived] = await Promise.all([
    ExtClub.findAll({ where: ACTIVE }),
    ExtClub.findAll({ where: ARCHIVE }),
  ]);
  const activeIds = extActive.map((c) => c.id);
  const archivedIds = extArchived.map((c) => c.id);
  const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

  let upserts = 0; // created + updated + restored
  let affectedArchived = 0;
  let affectedMissing = 0;

  await sequelize.transaction(async (tx) => {
    // Load existing local records for known external IDs, including soft-deleted
    const locals = await Club.findAll({
      where: { external_id: { [Op.in]: knownIds } },
      paranoid: false,
      transaction: tx,
    });
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    // Handle ACTIVE: create if missing, restore if soft-deleted, update only when changed
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

    // Ensure archived external clubs exist locally (soft-deleted) to stabilize IDs
    await ensureArchivedImported(
      Club,
      extArchived,
      (c) => ({ name: c.short_name }),
      actorId,
      tx
    );

    // Handle ARCHIVE: soft-delete if currently active
    const [archCnt] = await Club.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
        transaction: tx,
        paranoid: false,
      }
    );
    affectedArchived = archCnt;

    // Treat unknown/missing externally (not in ACTIVE or ARCHIVE) as missing → soft-delete
    if (knownIds.length) {
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
  const softDeletedTotal = affectedArchived + affectedMissing;
  logger.info(
    'Club sync: upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
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
