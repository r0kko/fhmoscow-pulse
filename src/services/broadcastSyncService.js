import { Op } from 'sequelize';

import { Game as ExtGame } from '../externalModels/index.js';
import { Match, MatchBroadcastLink } from '../models/index.js';
import { extractFirstUrl } from '../utils/url.js';
import sequelize from '../config/database.js';

async function syncBroadcastLinks({
  matchId,
  desired,
  locals,
  actorId,
  transaction,
}) {
  const byPos = new Map(locals.map((l) => [l.position, l]));
  const seen = new Set();
  let updated = 0;
  let deleted = 0;

  for (const d of desired) {
    seen.add(d.position);
    const local = byPos.get(d.position);
    if (!local) {
      await MatchBroadcastLink.create(
        {
          match_id: matchId,
          position: d.position,
          url: d.url,
          created_by: actorId,
          updated_by: actorId,
        },
        { transaction }
      );
      updated += 1;
      continue;
    }
    if (local.deletedAt) {
      await local.restore({ transaction });
    }
    if (local.url !== d.url) {
      await local.update({ url: d.url, updated_by: actorId }, { transaction });
      updated += 1;
    }
  }

  for (const [pos, local] of byPos.entries()) {
    if (!seen.has(pos) && !local.deletedAt) {
      await local.update({ updated_by: actorId }, { transaction });
      await local.destroy({ transaction });
      deleted += 1;
    }
  }

  return { updated, deleted };
}

export async function reconcileForMatch(matchId, actorId = null, tx = null) {
  const m = await Match.findByPk(matchId, {
    attributes: ['id', 'external_id'],
    transaction: tx,
    paranoid: false,
  });
  if (!m || !m.external_id) return { ok: false, reason: 'no_external_mapping' };

  const g = await ExtGame.findByPk(m.external_id, {
    attributes: ['id', 'broadcast', 'broadcast2'],
  });
  if (!g) return { ok: false, reason: 'external_not_found' };

  const desired = [
    { position: 1, url: extractFirstUrl(g.broadcast) },
    { position: 2, url: extractFirstUrl(g.broadcast2) },
  ].filter((x) => !!x.url);

  const locals = await MatchBroadcastLink.findAll({
    where: { match_id: matchId },
    paranoid: false,
    transaction: tx,
  });
  await syncBroadcastLinks({
    matchId,
    desired,
    locals,
    actorId,
    transaction: tx,
  });
  return { ok: true };
}

export default { reconcileForMatch };

// Bulk reconcile for a rolling window around now to keep links fresh and accurate.
// - daysAhead: upcoming matches within N days
// - daysBack: recent matches within N days back
// - limit: cap processed matches to avoid overload per run
export async function reconcileWindow({
  daysAhead = 7,
  daysBack = 3,
  limit = 500,
  actorId = null,
} = {}) {
  const now = new Date();
  const aheadMs = Math.max(0, Number(daysAhead)) * 24 * 60 * 60 * 1000;
  const backMs = Math.max(0, Number(daysBack)) * 24 * 60 * 60 * 1000;
  const start = new Date(now.getTime() - backMs);
  const end = new Date(now.getTime() + aheadMs);

  const matches = await Match.findAll({
    attributes: ['id', 'external_id', 'date_start'],
    where: {
      external_id: { [Op.ne]: null },
      date_start: { [Op.between]: [start, end] },
    },
    order: [['date_start', 'ASC']],
    limit: Math.max(1, Number(limit) || 500),
  });
  if (!matches.length) return { processed: 0, updated: 0, deleted: 0 };

  const extIds = Array.from(
    new Set(
      matches.map((m) => Number(m.external_id)).filter((x) => !Number.isNaN(x))
    )
  );
  const externals = await ExtGame.findAll({
    where: { id: { [Op.in]: extIds } },
  });
  const extById = new Map(externals.map((g) => [Number(g.id), g]));

  let updated = 0;
  let deleted = 0;
  await sequelize.transaction(async (tx) => {
    // Prefetch existing links for all selected matches to avoid N+1
    const matchIds = matches.map((m) => m.id);
    const allLinks = await MatchBroadcastLink.findAll({
      where: { match_id: { [Op.in]: matchIds } },
      paranoid: false,
      transaction: tx,
    });
    const linksByMatch = new Map();
    for (const l of allLinks) {
      const arr = linksByMatch.get(l.match_id) || [];
      arr.push(l);
      linksByMatch.set(l.match_id, arr);
    }

    for (const m of matches) {
      const g = extById.get(Number(m.external_id));
      const desired = g
        ? [
            { position: 1, url: extractFirstUrl(g.broadcast) },
            { position: 2, url: extractFirstUrl(g.broadcast2) },
          ].filter((x) => !!x.url)
        : [];
      const locals = linksByMatch.get(m.id) || [];
      const result = await syncBroadcastLinks({
        matchId: m.id,
        desired,
        locals,
        actorId,
        transaction: tx,
      });
      updated += result.updated;
      deleted += result.deleted;
    }
  });

  return { processed: matches.length, updated, deleted };
}

// Note: already exported above via `export async function reconcileWindow(...)`
