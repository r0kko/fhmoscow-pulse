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
    const [affectedArchived] = await Club.update(
      { deleted_at: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: archivedIds } },
        transaction: tx,
      }
    );

    // Soft-delete any club previously synced but now missing externally
    const [affectedMissing] = await Club.update(
      { deleted_at: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.notIn]: activeIds, [Op.ne]: null } },
        transaction: tx,
      }
    );

    logger.info(
      'Club sync: upserted=%d, softDeleted=%d',
      upserts,
      affectedArchived + affectedMissing
    );
  });
}

async function listAll() {
  return Club.findAll({ order: [['name', 'ASC']] });
}

export default { syncExternal, listAll };
