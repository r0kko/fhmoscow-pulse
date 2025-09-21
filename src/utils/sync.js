import { fn, col as column, where, Op } from 'sequelize';

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * Common ACTIVE/ARCHIVE filters for external DB, tolerant to case/whitespace.
 * @param {string} col - column name holding status (default: 'object_status')
 */
export function statusFilters(col = 'object_status') {
  const c = column(col);
  const normalize = (value) => where(fn('LOWER', fn('TRIM', c)), value);
  const ACTIVE = normalize('active');
  const NEW = normalize('new');
  const ARCHIVE = normalize('archive');

  return {
    ACTIVE,
    NEW,
    ACTIVE_OR_NEW: { [Op.or]: [ACTIVE, NEW] },
    ARCHIVE,
  };
}

/**
 * Ensure that archived records from an external source are present locally
 * as soft-deleted rows, so they get stable IDs for relations/UI.
 *
 * @param {import('sequelize').ModelStatic<any>} LocalModel Sequelize model
 * @param {Array<Object>} extArchived external records with numeric `id`
 * @param {Function} mapFn mapping ext -> partial local fields (excluding external_id)
 * @param {string|UUID|null} actorId audit user id
 * @param {import('sequelize').Transaction} [transaction] optional transaction
 * @returns {Promise<number>} number of created soft-deleted rows
 */
export async function ensureArchivedImported(
  LocalModel,
  extArchived,
  mapFn,
  actorId,
  transaction
) {
  if (!extArchived?.length) return 0;
  const archivedIds = extArchived.map((r) => r.id);
  const locals = await LocalModel.findAll({
    where: { external_id: { [Op.in]: archivedIds } },
    paranoid: false,
    transaction,
  });
  const have = new Set(locals.map((l) => l.external_id));
  let created = 0;
  for (const r of extArchived) {
    if (have.has(r.id)) continue;
    const desired = (typeof mapFn === 'function' ? mapFn(r) : {}) || {};
    await LocalModel.create(
      {
        external_id: r.id,
        ...desired,
        deletedAt: new Date(),
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction }
    );
    created += 1;
  }
  return created;
}

export function buildSinceClause(
  since,
  fields = ['date_update', 'date_create']
) {
  if (!since) return null;
  const ts = toDate(since);
  if (!ts) return null;
  const clauses = fields
    .filter((field) => typeof field === 'string' && field)
    .map((field) => ({ [field]: { [Op.gte]: ts } }));
  if (!clauses.length) return null;
  return { [Op.or]: clauses };
}

export function maxTimestamp(
  records = [],
  fields = ['date_update', 'date_create']
) {
  let max = null;
  for (const record of records) {
    if (!record) continue;
    for (const field of fields) {
      const value = record[field];
      if (!value) continue;
      const date = toDate(value);
      if (!date) continue;
      if (!max || date.getTime() > max.getTime()) {
        max = date;
      }
    }
  }
  return max;
}

export function normalizeSyncOptions(options = {}) {
  if (options == null) {
    return {
      actorId: null,
      requestedMode: 'incremental',
      mode: 'full',
      since: null,
      fullResync: true,
    };
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    return {
      actorId: options || null,
      requestedMode: 'incremental',
      mode: 'full',
      since: null,
      fullResync: true,
    };
  }
  const actorId = options.actorId ?? options.userId ?? null;
  const wantedMode = String(options.mode || 'incremental').toLowerCase();
  const since = toDate(options.since);
  let fullResync = wantedMode === 'full';
  if (!since) fullResync = true;
  const mode = fullResync ? 'full' : 'incremental';
  return {
    actorId,
    requestedMode: wantedMode,
    mode,
    since,
    fullResync,
  };
}

export default {
  statusFilters,
  ensureArchivedImported,
  buildSinceClause,
  maxTimestamp,
  normalizeSyncOptions,
  toDate,
};
