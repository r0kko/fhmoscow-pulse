import { fn, col as column, where, Op } from 'sequelize';

/**
 * Common ACTIVE/ARCHIVE filters for external DB, tolerant to case/whitespace.
 * @param {string} col - column name holding status (default: 'object_status')
 */
export function statusFilters(col = 'object_status') {
  const c = column(col);
  return {
    ACTIVE: where(fn('LOWER', fn('TRIM', c)), 'active'),
    ARCHIVE: where(fn('LOWER', fn('TRIM', c)), 'archive'),
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

export default { statusFilters, ensureArchivedImported };
