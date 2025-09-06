import { Op } from 'sequelize';

import { GameViolation } from '../models/index.js';
import { GameViolation as ExtGameViolation } from '../externalModels/index.js';
import logger from '../../logger.js';

async function syncExternal(actorId = null) {
  const extRows = await ExtGameViolation.findAll();
  const extIds = extRows.map((x) => x.id);

  let upserts = 0;
  let softDeleted = 0;

  await GameViolation.sequelize.transaction(async (tx) => {
    const locals = extIds.length
      ? await GameViolation.findAll({
          where: { external_id: { [Op.in]: extIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    for (const r of extRows) {
      const local = localByExt.get(r.id);
      const desired = { name: r.name || null, full_name: r.full_name || null };
      if (!local) {
        await GameViolation.create(
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
      if (local.full_name !== desired.full_name)
        updates.full_name = desired.full_name;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        upserts += 1;
      }
    }

    if (extIds.length) {
      const [softCnt] = await GameViolation.update(
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
    'GameViolation sync: upserted=%d, softDeleted=%d',
    upserts,
    softDeleted
  );
  return { upserts, softDeleted };
}

export default { syncExternal };
