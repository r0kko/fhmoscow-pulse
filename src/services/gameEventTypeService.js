import { Op } from 'sequelize';

import { GameEventType } from '../models/index.js';
import { GameEventType as ExtGameEventType } from '../externalModels/index.js';
import logger from '../../logger.js';
import { normalizeSyncOptions } from '../utils/sync.js';

async function syncExternal(options = {}) {
  const { actorId, mode, fullResync } = normalizeSyncOptions(options);
  const extRows = await ExtGameEventType.findAll();
  const extIds = extRows.map((x) => x.id);

  let upserts = 0;
  let softDeleted = 0;

  await GameEventType.sequelize.transaction(async (tx) => {
    const locals = extIds.length
      ? await GameEventType.findAll({
          where: { external_id: { [Op.in]: extIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    for (const r of extRows) {
      const local = localByExt.get(r.id);
      const desired = { name: r.name || null };
      if (!local) {
        await GameEventType.create(
          {
            external_id: r.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        upserts += 1;
        continue;
      }
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        upserts += 1;
      }
      const updates = {};
      if (local.name !== desired.name) updates.name = desired.name;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        upserts += 1;
      }
    }

    if (fullResync && extIds.length) {
      const [softCnt] = await GameEventType.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: extIds, [Op.ne]: null },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      softDeleted = softCnt;
    }
  });

  logger.info(
    'GameEventType sync (mode=%s): upserted=%d, softDeleted=%d',
    mode,
    upserts,
    softDeleted
  );
  return { upserts, softDeleted, mode, cursor: null, fullSync: fullResync };
}

export default { syncExternal };
