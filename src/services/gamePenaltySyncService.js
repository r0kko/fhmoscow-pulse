import { createHash } from 'crypto';

import { Op, literal } from 'sequelize';

import {
  GamePenalty,
  Match,
  GameEventType,
  Player,
  GameViolation,
  PenaltyMinutes,
} from '../models/index.js';
import {
  GameEvent as ExtGameEvent,
  GameEventType as ExtGameEventType,
  PenaltyMinutes as ExtPenaltyMinutes,
} from '../externalModels/index.js';
import logger from '../../logger.js';

// Resolve external event_type_id for penalties (Нарушение)
async function getExternalPenaltyTypeId() {
  // Try local (case-insensitive) first
  const row = await GameEventType.findOne({
    attributes: ['external_id'],
    where: { name: { [Op.iLike]: 'Нарушение' } },
    paranoid: false,
  });
  if (row?.external_id) return row.external_id;
  // Fallback to external dictionary by name
  try {
    const ext = await ExtGameEventType.findOne({
      where: { name: 'Нарушение' },
    });
    if (ext?.id) return Number(ext.id);
  } catch (_e) {
    /* empty */
  }
  return null;
}

// Upsert and soft-delete penalties for a single match by its local UUID
export async function reconcileForMatch(matchId, actorId = null, tx = null) {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'external_id'],
    paranoid: false,
    transaction: tx,
  });
  if (!match || !match.external_id) {
    return { ok: false, reason: 'no_external_mapping' };
  }

  const penaltyTypeExtId = await getExternalPenaltyTypeId();
  if (!penaltyTypeExtId) return { ok: false, reason: 'event_type_not_synced' };

  // Fetch external penalties for this game only, selecting necessary fields
  const extRows = await ExtGameEvent.findAll({
    where: {
      game_id: Number(match.external_id),
      event_type_id: penaltyTypeExtId,
    },
    attributes: [
      'id',
      'game_id',
      'event_type_id',
      'penalty_player_id',
      'penalty_violation_id',
      'minute',
      'second',
      'period',
      'penalty_minutes_id',
      'team_penalty',
    ],
  });

  // Build cross-table mappings
  const extPlayerIds = Array.from(
    new Set(
      extRows
        .map((r) => Number(r.penalty_player_id))
        .filter((x) => !Number.isNaN(x))
    )
  );
  const extViolationIds = Array.from(
    new Set(
      extRows
        .map((r) => Number(r.penalty_violation_id))
        .filter((x) => !Number.isNaN(x))
    )
  );
  const extMinutesIds = Array.from(
    new Set(
      extRows
        .map((r) => Number(r.penalty_minutes_id))
        .filter((x) => !Number.isNaN(x))
    )
  );

  // Ensure local PenaltyMinutes rows exist for all external ids we'll reference
  if (extMinutesIds.length) {
    const existing = await PenaltyMinutes.findAll({
      attributes: ['id', 'external_id'],
      where: { external_id: { [Op.in]: extMinutesIds } },
      paranoid: false,
      transaction: tx,
    });
    const existingSet = new Set(existing.map((m) => Number(m.external_id)));
    const missing = extMinutesIds.filter((id) => !existingSet.has(id));
    if (missing.length) {
      const extDict = await ExtPenaltyMinutes.findAll({
        where: { id: { [Op.in]: missing } },
        attributes: ['id', 'name'],
      });
      for (const r of extDict) {
        await PenaltyMinutes.create(
          {
            external_id: Number(r.id),
            name: r.name || null,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
      }
    }
  }

  const [players, violations, minutes, localType] = await Promise.all([
    extPlayerIds.length
      ? Player.findAll({
          attributes: ['id', 'external_id'],
          where: { external_id: { [Op.in]: extPlayerIds } },
          paranoid: false,
          transaction: tx,
        })
      : Promise.resolve([]),
    extViolationIds.length
      ? GameViolation.findAll({
          attributes: ['id', 'external_id'],
          where: { external_id: { [Op.in]: extViolationIds } },
          paranoid: false,
          transaction: tx,
        })
      : Promise.resolve([]),
    extMinutesIds.length
      ? PenaltyMinutes.findAll({
          attributes: ['id', 'external_id'],
          where: { external_id: { [Op.in]: extMinutesIds } },
          paranoid: false,
          transaction: tx,
        })
      : Promise.resolve([]),
    GameEventType.findOne({
      attributes: ['id', 'external_id'],
      where: { external_id: penaltyTypeExtId },
      paranoid: false,
      transaction: tx,
    }),
  ]);

  const playerByExt = new Map(players.map((p) => [Number(p.external_id), p]));
  const violationByExt = new Map(
    violations.map((v) => [Number(v.external_id), v])
  );
  const minutesByExt = new Map(minutes.map((m) => [Number(m.external_id), m]));
  const eventTypeId = localType?.id || null;
  if (!eventTypeId) {
    logger.warn(
      'GamePenalty reconcile skipped: local GameEventType missing for external id=%s',
      penaltyTypeExtId
    );
    return { ok: false, reason: 'event_type_not_imported' };
  }

  const extIds = extRows.map((r) => Number(r.id));

  let upserted = 0;
  let softDeleted = 0;

  const run = async (t) => {
    const locals = extIds.length
      ? await GamePenalty.findAll({
          where: { external_id: { [Op.in]: extIds } },
          paranoid: false,
          transaction: t,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [Number(l.external_id), l]));

    for (const r of extRows) {
      const desired = {
        game_id: match.id,
        event_type_id: eventTypeId,
        penalty_player_id:
          playerByExt.get(Number(r.penalty_player_id))?.id || null,
        penalty_violation_id:
          violationByExt.get(Number(r.penalty_violation_id))?.id || null,
        minute: r.minute ?? null,
        second: r.second ?? null,
        period: r.period ?? null,
        penalty_minutes_id:
          minutesByExt.get(Number(r.penalty_minutes_id))?.id || null,
        team_penalty: r.team_penalty ?? null,
      };
      const local = localByExt.get(Number(r.id));
      if (!local) {
        await GamePenalty.create(
          {
            external_id: Number(r.id),
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: t }
        );
        upserted += 1;
        continue;
      }
      if (local.deletedAt) {
        await local.restore({ transaction: t });
        upserted += 1;
      }
      const updates = {};
      for (const k of Object.keys(desired)) {
        if (local[k] !== desired[k]) updates[k] = desired[k];
      }
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: t });
        upserted += 1;
      }
    }

    // Soft-delete missing by match scope
    if (match.id) {
      const where = {
        game_id: match.id,
        deletedAt: null,
      };
      if (extIds.length) where.external_id = { [Op.notIn]: extIds };
      const [cnt] = await GamePenalty.update(
        { deletedAt: new Date(), updated_by: actorId },
        { where, transaction: t, paranoid: false }
      );
      softDeleted = cnt;
    }
  };

  if (tx) await run(tx);
  else await GamePenalty.sequelize.transaction(run);

  logger.info(
    'GamePenalty reconcile for match %s: upserted=%d, softDeleted=%d',
    matchId,
    upserted,
    softDeleted
  );
  return { ok: true, upserts: upserted, softDeleted };
}

// Bulk reconcile penalties for a rolling window around now
// Fixed defaults for windowed reconcile (in code; no env overrides)
const DEFAULT_PENALTY_WINDOW_AHEAD_DAYS = 7;
const DEFAULT_PENALTY_WINDOW_BACK_DAYS = 14;
const DEFAULT_PENALTY_WINDOW_LIMIT = 400;
const DEFAULT_PENALTY_INCLUDE_NO_DATE = true;
const DEFAULT_PENALTY_NO_DATE_LIMIT = 100;

export async function reconcileWindow({
  daysAhead = DEFAULT_PENALTY_WINDOW_AHEAD_DAYS,
  daysBack = DEFAULT_PENALTY_WINDOW_BACK_DAYS,
  limit = DEFAULT_PENALTY_WINDOW_LIMIT,
  actorId = null,
} = {}) {
  const penaltyTypeExtId = await getExternalPenaltyTypeId();
  if (!penaltyTypeExtId) {
    logger.warn(
      'GamePenalty window sync skipped: event type "Нарушение" not found'
    );
    return { processed: 0, updated: 0, deleted: 0 };
  }

  const now = new Date();
  const start = new Date(now.getTime() - Math.max(0, daysBack) * 86400000);
  const end = new Date(now.getTime() + Math.max(0, daysAhead) * 86400000);

  const matches = await Match.findAll({
    attributes: ['id', 'external_id', 'date_start'],
    where: {
      external_id: { [Op.ne]: null },
      date_start: { [Op.between]: [start, end] },
    },
    order: [['date_start', 'ASC']],
    limit: Math.max(1, Number(limit) || 400),
  });
  let finalMatches = matches;
  if (!finalMatches.length) {
    const includeNoDate = DEFAULT_PENALTY_INCLUDE_NO_DATE;
    if (includeNoDate) {
      const noDateLimit = Math.max(1, DEFAULT_PENALTY_NO_DATE_LIMIT);
      const noDate = await Match.findAll({
        attributes: ['id', 'external_id', 'date_start'],
        where: { external_id: { [Op.ne]: null }, date_start: null },
        order: [['updatedAt', 'DESC']],
        limit: noDateLimit,
      });
      finalMatches = noDate;
    }
  }
  if (!finalMatches.length) return { processed: 0, updated: 0, deleted: 0 };

  const extGameIds = Array.from(
    new Set(
      finalMatches
        .map((m) => Number(m.external_id))
        .filter((x) => !Number.isNaN(x))
    )
  );

  const extEvents = await ExtGameEvent.findAll({
    where: {
      game_id: { [Op.in]: extGameIds },
      event_type_id: penaltyTypeExtId,
    },
    attributes: [
      'id',
      'game_id',
      'event_type_id',
      'penalty_player_id',
      'penalty_violation_id',
      'minute',
      'second',
      'period',
      'penalty_minutes_id',
      'team_penalty',
    ],
  });

  // Group by game_id
  const eventsByGame = new Map();
  for (const e of extEvents) {
    const gid = Number(e.game_id);
    const arr = eventsByGame.get(gid) || [];
    arr.push(e);
    eventsByGame.set(gid, arr);
  }

  // Prefetch cross-table mappings for all events
  const extPlayerIds = Array.from(
    new Set(
      extEvents
        .map((r) => Number(r.penalty_player_id))
        .filter((x) => !Number.isNaN(x))
    )
  );
  const extViolationIds = Array.from(
    new Set(
      extEvents
        .map((r) => Number(r.penalty_violation_id))
        .filter((x) => !Number.isNaN(x))
    )
  );
  const extMinutesIds = Array.from(
    new Set(
      extEvents
        .map((r) => Number(r.penalty_minutes_id))
        .filter((x) => !Number.isNaN(x))
    )
  );

  // Ensure local PenaltyMinutes rows exist for all external ids we'll reference
  if (extMinutesIds.length) {
    const existing = await PenaltyMinutes.findAll({
      attributes: ['id', 'external_id'],
      where: { external_id: { [Op.in]: extMinutesIds } },
      paranoid: false,
    });
    const existingSet = new Set(existing.map((m) => Number(m.external_id)));
    const missing = extMinutesIds.filter((id) => !existingSet.has(id));
    if (missing.length) {
      const extDict = await ExtPenaltyMinutes.findAll({
        where: { id: { [Op.in]: missing } },
        attributes: ['id', 'name'],
      });
      await PenaltyMinutes.sequelize.transaction(async (t) => {
        for (const r of extDict) {
          await PenaltyMinutes.create(
            { external_id: Number(r.id), name: r.name || null },
            { transaction: t }
          );
        }
      });
    }
  }

  const [players, violations, minutes, localType] = await Promise.all([
    extPlayerIds.length
      ? Player.findAll({
          attributes: ['id', 'external_id'],
          where: { external_id: { [Op.in]: extPlayerIds } },
        })
      : Promise.resolve([]),
    extViolationIds.length
      ? GameViolation.findAll({
          attributes: ['id', 'external_id'],
          where: { external_id: { [Op.in]: extViolationIds } },
        })
      : Promise.resolve([]),
    extMinutesIds.length
      ? PenaltyMinutes.findAll({
          attributes: ['id', 'external_id'],
          where: { external_id: { [Op.in]: extMinutesIds } },
        })
      : Promise.resolve([]),
    GameEventType.findOne({
      attributes: ['id', 'external_id'],
      where: { external_id: penaltyTypeExtId },
    }),
  ]);

  const playerByExt = new Map(players.map((p) => [Number(p.external_id), p]));
  const violationByExt = new Map(
    violations.map((v) => [Number(v.external_id), v])
  );
  const minutesByExt = new Map(minutes.map((m) => [Number(m.external_id), m]));
  const eventTypeId = localType?.id || null;

  let updated = 0;
  let deleted = 0;

  await GamePenalty.sequelize.transaction(async (t) => {
    // Prefetch existing penalties for selected matches
    const matchIds = finalMatches.map((m) => m.id);
    const locals = await GamePenalty.findAll({
      where: { game_id: { [Op.in]: matchIds } },
      paranoid: false,
      transaction: t,
    });
    const localByExt = new Map(locals.map((l) => [Number(l.external_id), l]));

    // Build quick map matchId -> ext game id
    const gameIdByMatch = new Map(
      finalMatches.map((m) => [m.id, Number(m.external_id)])
    );

    for (const m of finalMatches) {
      const gid = gameIdByMatch.get(m.id);
      const rows = eventsByGame.get(gid) || [];
      const extIds = rows.map((r) => Number(r.id));
      const seen = new Set();
      for (const r of rows) {
        const desired = {
          game_id: m.id,
          event_type_id: eventTypeId,
          penalty_player_id:
            playerByExt.get(Number(r.penalty_player_id))?.id || null,
          penalty_violation_id:
            violationByExt.get(Number(r.penalty_violation_id))?.id || null,
          minute: r.minute ?? null,
          second: r.second ?? null,
          period: r.period ?? null,
          penalty_minutes_id:
            minutesByExt.get(Number(r.penalty_minutes_id))?.id || null,
          team_penalty: r.team_penalty ?? null,
        };
        const local = localByExt.get(Number(r.id));
        if (!local) {
          await GamePenalty.create(
            {
              external_id: Number(r.id),
              ...desired,
              created_by: actorId,
              updated_by: actorId,
            },
            { transaction: t }
          );
          updated += 1;
          continue;
        }
        if (local.deletedAt) await local.restore({ transaction: t });
        const updates = {};
        for (const k of Object.keys(desired)) {
          if (local[k] !== desired[k]) updates[k] = desired[k];
        }
        if (Object.keys(updates).length) {
          updates.updated_by = actorId;
          await local.update(updates, { transaction: t });
          updated += 1;
        }
        seen.add(Number(r.id));
      }
      // Soft-delete missing for this match
      const where = { game_id: m.id, deletedAt: null };
      if (extIds.length) where.external_id = { [Op.notIn]: extIds };
      const [cnt] = await GamePenalty.update(
        { deletedAt: new Date(), updated_by: actorId },
        { where, transaction: t, paranoid: false }
      );
      deleted += cnt;
    }
  });

  return { processed: finalMatches.length, updated, deleted };
}

// Full external sync for all penalties ("Нарушение") across all matches we know about.
// Behavior mirrors other dictionary syncs: upsert known external rows, soft-delete missing.
export async function syncExternal(actorId = null) {
  const penaltyTypeExtId = await getExternalPenaltyTypeId();
  if (!penaltyTypeExtId) {
    logger.warn(
      'GamePenalty full sync skipped: event type "Нарушение" not found'
    );
    return { upserts: 0, softDeleted: 0 };
  }

  // Fetch all local matches that have an external mapping; we only sync events for those.
  const matches = await Match.findAll({
    attributes: ['id', 'external_id'],
    where: { external_id: { [Op.ne]: null } },
    paranoid: false,
  });
  if (!matches.length) return { upserts: 0, softDeleted: 0 };

  const extGameIds = matches
    .map((m) => Number(m.external_id))
    .filter((x) => !Number.isNaN(x));
  if (!extGameIds.length) return { upserts: 0, softDeleted: 0 };

  // Helper: stable MD5 fingerprint over relevant external fields
  const computeFp = (r) => {
    const norm = (v, isBool = false) =>
      v == null ? '#' : isBool ? (v ? '1' : '0') : String(v);
    const payload = [
      norm(r.penalty_player_id),
      norm(r.penalty_violation_id),
      norm(r.minute),
      norm(r.second),
      norm(r.period),
      norm(r.penalty_minutes_id),
      norm(r.team_penalty, true),
    ].join('|');
    return createHash('md5').update(payload).digest('hex');
  };

  // Phase 1: scan external ids + lightweight checksum per row
  const fpExpr = literal(
    // eslint-disable-next-line
    "MD5(CONCAT_WS('|', COALESCE(penalty_player_id,'#'), COALESCE(penalty_violation_id,'#'), COALESCE(minute,'#'), COALESCE(second,'#'), COALESCE(period,'#'), COALESCE(penalty_minutes_id,'#'), COALESCE(team_penalty,'#')))"
  );
  const extSummary = await ExtGameEvent.findAll({
    where: {
      game_id: { [Op.in]: extGameIds },
      event_type_id: penaltyTypeExtId,
    },
    attributes: ['id', 'game_id', [fpExpr, 'fp']],
    raw: true,
  });

  const gameIdByExt = new Map(
    matches.map((m) => [Number(m.external_id), m.id])
  );
  const byGameExt = new Map();
  const extIds = [];
  const fpById = new Map();
  let detailsIncluded = false;
  for (const r of extSummary) {
    const gid = Number(r.game_id);
    const arr = byGameExt.get(gid) || [];
    arr.push(r);
    byGameExt.set(gid, arr);
    const idNum = Number(r.id);
    extIds.push(idNum);
    const fp =
      r.fp || (r.penalty_player_id !== undefined ? computeFp(r) : null);
    if (!r.fp && r.penalty_player_id !== undefined) detailsIncluded = true;
    if (fp) fpById.set(idNum, String(fp));
  }

  // Prefetch locals only for known external ids
  const locals = extIds.length
    ? await GamePenalty.findAll({
        attributes: [
          'id',
          'external_id',
          'external_fp',
          'game_id',
          'deletedAt',
        ],
        where: { external_id: { [Op.in]: extIds } },
        paranoid: false,
      })
    : [];
  const localByExt = new Map(locals.map((l) => [Number(l.external_id), l]));

  // Identify new/changed rows
  const changedOrNew = [];
  for (const r of extSummary) {
    const idNum = Number(r.id);
    const local = localByExt.get(idNum);
    const matchId = gameIdByExt.get(Number(r.game_id)) || null;
    if (!matchId) continue;
    if (!local) {
      changedOrNew.push(idNum);
      continue;
    }
    const fpNow = fpById.get(idNum) || null;
    const changedFp = (local.external_fp || null) !== (fpNow || null);
    const movedGame = local.game_id !== matchId;
    const wasDeleted = !!local.deletedAt;
    if (changedFp || movedGame || wasDeleted) changedOrNew.push(idNum);
  }

  // Phase 2: fetch details only for changed/new ids (unless details are already present)
  let changedRows = [];
  if (changedOrNew.length) {
    if (detailsIncluded) {
      const set = new Set(changedOrNew);
      changedRows = extSummary.filter((r) => set.has(Number(r.id)));
    } else {
      const attrs = [
        'id',
        'game_id',
        'penalty_player_id',
        'penalty_violation_id',
        'minute',
        'second',
        'period',
        'penalty_minutes_id',
        'team_penalty',
      ];
      // Chunk IN list to avoid oversized queries
      const chunk = (arr, n) =>
        Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
          arr.slice(i * n, i * n + n)
        );
      const chunks = chunk(changedOrNew, 1000);
      for (const ids of chunks) {
        const part = await ExtGameEvent.findAll({
          where: { id: { [Op.in]: ids } },
          attributes: attrs,
          raw: true,
        });
        changedRows.push(...part);
      }
    }
  }

  // Prefetch cross-table mappings only for changed/new rows
  const extPlayerIds = Array.from(
    new Set(
      changedRows
        .map((r) => Number(r.penalty_player_id))
        .filter((x) => !Number.isNaN(x))
    )
  );
  const extViolationIds = Array.from(
    new Set(
      changedRows
        .map((r) => Number(r.penalty_violation_id))
        .filter((x) => !Number.isNaN(x))
    )
  );
  const extMinutesIds = Array.from(
    new Set(
      changedRows
        .map((r) => Number(r.penalty_minutes_id))
        .filter((x) => !Number.isNaN(x))
    )
  );

  // Ensure local PenaltyMinutes rows exist for any external ids in changedRows
  if (extMinutesIds.length) {
    const existing = await PenaltyMinutes.findAll({
      attributes: ['id', 'external_id'],
      where: { external_id: { [Op.in]: extMinutesIds } },
      paranoid: false,
      raw: true,
    });
    const existingSet = new Set(existing.map((m) => Number(m.external_id)));
    const missing = extMinutesIds.filter((id) => !existingSet.has(id));
    if (missing.length) {
      const extDict = await ExtPenaltyMinutes.findAll({
        where: { id: { [Op.in]: missing } },
        attributes: ['id', 'name'],
        raw: true,
      });
      await PenaltyMinutes.sequelize.transaction(async (t) => {
        for (const r of extDict) {
          await PenaltyMinutes.create(
            { external_id: Number(r.id), name: r.name || null },
            { transaction: t }
          );
        }
      });
    }
  }

  const [players, violations, minutes, localType] = await Promise.all([
    extPlayerIds.length
      ? Player.findAll({
          attributes: ['id', 'external_id'],
          where: { external_id: { [Op.in]: extPlayerIds } },
          paranoid: false,
          raw: true,
        })
      : Promise.resolve([]),
    extViolationIds.length
      ? GameViolation.findAll({
          attributes: ['id', 'external_id'],
          where: { external_id: { [Op.in]: extViolationIds } },
          paranoid: false,
          raw: true,
        })
      : Promise.resolve([]),
    extMinutesIds.length
      ? PenaltyMinutes.findAll({
          attributes: ['id', 'external_id'],
          where: { external_id: { [Op.in]: extMinutesIds } },
          paranoid: false,
          raw: true,
        })
      : Promise.resolve([]),
    GameEventType.findOne({
      attributes: ['id', 'external_id'],
      where: { external_id: penaltyTypeExtId },
      paranoid: false,
      raw: true,
    }),
  ]);

  const playerByExt = new Map(players.map((p) => [Number(p.external_id), p]));
  const violationByExt = new Map(
    violations.map((v) => [Number(v.external_id), v])
  );
  const minutesByExt = new Map(minutes.map((m) => [Number(m.external_id), m]));
  const eventTypeId = localType?.id || null;
  if (!eventTypeId) {
    logger.warn(
      'GamePenalty full sync skipped: local GameEventType missing for external id=%s',
      penaltyTypeExtId
    );
    return { upserts: 0, softDeleted: 0 };
  }

  let upserts = 0;
  let softDeleted = 0;

  await GamePenalty.sequelize.transaction(async (t) => {
    // Apply inserts/updates only for changed/new rows
    for (const r of changedRows) {
      const idNum = Number(r.id);
      const local = localByExt.get(idNum);
      const matchId = gameIdByExt.get(Number(r.game_id)) || null;
      if (!matchId) continue;
      const desired = {
        game_id: matchId,
        event_type_id: eventTypeId,
        penalty_player_id:
          playerByExt.get(Number(r.penalty_player_id))?.id || null,
        penalty_violation_id:
          violationByExt.get(Number(r.penalty_violation_id))?.id || null,
        minute: r.minute ?? null,
        second: r.second ?? null,
        period: r.period ?? null,
        penalty_minutes_id:
          minutesByExt.get(Number(r.penalty_minutes_id))?.id || null,
        team_penalty: r.team_penalty ?? null,
      };
      const fp = fpById.get(idNum) || computeFp(r);
      if (!local) {
        await GamePenalty.create(
          {
            external_id: idNum,
            ...desired,
            external_fp: fp,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: t }
        );
        upserts += 1;
        continue;
      }
      // Restore if needed
      if (local.deletedAt) {
        await local.restore({ transaction: t });
        upserts += 1;
      }
      const updates = {};
      for (const k of Object.keys(desired)) {
        if (local[k] !== desired[k]) updates[k] = desired[k];
      }
      if ((local.external_fp || null) !== (fp || null))
        updates.external_fp = fp;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: t });
        upserts += 1;
      }
    }

    // Soft-delete missing per-match for accuracy (no need to select beforehand)
    for (const m of matches) {
      const gid = Number(m.external_id);
      const rows = byGameExt.get(gid) || [];
      const extIdsForMatch = rows.map((x) => Number(x.id));
      const where = { game_id: m.id, deletedAt: null };
      if (extIdsForMatch.length)
        where.external_id = { [Op.notIn]: extIdsForMatch };
      const [cnt] = await GamePenalty.update(
        { deletedAt: new Date(), updated_by: actorId },
        { where, transaction: t, paranoid: false }
      );
      softDeleted += cnt;
    }
  });

  logger.info(
    'GamePenalty full sync: scanned=%d, changed=%d, upserted=%d, softDeleted=%d',
    extSummary.length,
    changedOrNew.length,
    upserts,
    softDeleted
  );
  return {
    upserts,
    softDeleted,
    scanned: extSummary.length,
    changed: changedOrNew.length,
  };
}

export default { reconcileForMatch, reconcileWindow, syncExternal };
