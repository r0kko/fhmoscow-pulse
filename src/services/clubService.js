import { Op, fn, col, where } from 'sequelize';

import { Club } from '../models/index.js';
import { Club as ExtClub } from '../externalModels/index.js';
import sequelize from '../config/database.js';
import logger from '../../logger.js';

async function syncExternal(actorId = null) {
  // Pull ACTIVE and ARCHIVE sets explicitly; be tolerant to case/whitespace
  const ACTIVE = where(fn('LOWER', fn('TRIM', col('object_status'))), 'active');
  const ARCHIVE = where(
    fn('LOWER', fn('TRIM', col('object_status'))),
    'archive'
  );
  const [extClubs, extArchived] = await Promise.all([
    ExtClub.findAll({ where: ACTIVE }),
    ExtClub.findAll({ where: ARCHIVE }),
  ]);
  const activeIds = extClubs.map((c) => c.id);
  const archivedIds = extArchived.map((c) => c.id);

  let upserts = 0;
  let affectedArchived = 0;
  let affectedMissing = 0;

  await sequelize.transaction(async (tx) => {
    for (const c of extClubs) {
      await Club.upsert(
        {
          external_id: c.id,
          name: c.short_name,
          deleted_at: null, // restore if was soft-deleted
          created_by: actorId,
          updated_by: actorId,
        },
        { paranoid: false, transaction: tx }
      );
      upserts += 1;
    }

    // Soft-delete clubs explicitly archived externally
    const [archCnt] = await Club.update(
      { deleted_at: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: archivedIds } },
        transaction: tx,
      }
    );
    affectedArchived = archCnt;

    // Soft-delete any club previously synced but now missing externally
    const [missCnt] = await Club.update(
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
