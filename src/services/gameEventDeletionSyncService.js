import { Op } from 'sequelize';

import { GamePenalty } from '../models/index.js';
import { GameEvent as ExtGameEvent } from '../externalModels/index.js';
import logger from '../../logger.js';

/**
 * Deletion-only reconcile: soft-delete local penalties whose external game_event rows no longer exist.
 * Scans local table in stable batches to avoid heavy memory usage.
 *
 * Env tuning:
 * - GAME_EVENT_DELETION_BATCH (default 1000)
 * - GAME_EVENT_DELETION_MAX_BATCHES (default 50)
 */
// Fixed defaults for deletion-only reconcile (in code; no env overrides)
const DEFAULT_DELETION_BATCH = 1000;
const DEFAULT_DELETION_MAX_BATCHES = 50;

export async function reapOrphans({
  batchSize = DEFAULT_DELETION_BATCH,
  maxBatches = DEFAULT_DELETION_MAX_BATCHES,
  actorId = null,
} = {}) {
  let batches = 0;
  let scanned = 0;
  let deleted = 0;

  // Cursor fields for stable iteration
  let lastCreatedAt = null;
  let lastId = null;

  while (batches < Math.max(1, maxBatches)) {
    batches += 1;
    const where = { deletedAt: null };
    if (lastCreatedAt || lastId) {
      where[Op.or] = [
        { createdAt: { [Op.gt]: lastCreatedAt } },
        { createdAt: lastCreatedAt, id: { [Op.gt]: lastId } },
      ];
    }

    const rows = await GamePenalty.findAll({
      attributes: ['id', 'external_id', 'createdAt'],
      where,
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: Math.max(1, Number(batchSize) || 1000),
      paranoid: false,
    });
    if (!rows.length) break;

    // Advance cursor
    const last = rows[rows.length - 1];
    lastCreatedAt = last.createdAt;
    lastId = last.id;

    const extIds = rows
      .map((r) => Number(r.external_id))
      .filter((x) => Number.isFinite(x));
    if (!extIds.length) {
      scanned += rows.length;
      continue;
    }

    // Fetch existing external ids
    const existing = await ExtGameEvent.findAll({
      attributes: ['id'],
      where: { id: { [Op.in]: extIds } },
    });
    const have = new Set(existing.map((e) => Number(e.id)));
    const toDelete = extIds.filter((id) => !have.has(id));

    if (toDelete.length) {
      const [cnt] = await GamePenalty.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: { external_id: { [Op.in]: toDelete }, deletedAt: null },
          paranoid: false,
        }
      );
      deleted += cnt;
    }

    scanned += rows.length;
  }

  logger.info(
    'GameEvent deletion-only reconcile: scanned=%d, deleted=%d, batches=%d',
    scanned,
    deleted,
    batches - 1
  );
  return { scanned, deleted, batches: batches - 1 };
}

export default { reapOrphans };
