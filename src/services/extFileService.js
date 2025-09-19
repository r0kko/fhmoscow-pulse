import { Op } from 'sequelize';

import { ExtFile as ExtFileExternal } from '../externalModels/index.js';
import ExtFile from '../models/extFile.js';
import sequelize from '../config/database.js';
import { ensureArchivedImported, statusFilters } from '../utils/sync.js';

function normalizeDate(val) {
  return val ? new Date(val) : null;
}

function normalizeStatus(val) {
  return typeof val === 'string' ? val.trim().toLowerCase() : null;
}

function equal(a, b) {
  if (a == null && b == null) return true;
  if (a instanceof Date || b instanceof Date) {
    const ta = a ? new Date(a).getTime() : null;
    const tb = b ? new Date(b).getTime() : null;
    return ta === tb;
  }
  return a === b;
}

export async function syncExtFiles({
  actorId = null,
  externalIds = null,
} = {}) {
  const scopeIds = Array.isArray(externalIds)
    ? externalIds.filter((id) => Number.isFinite(Number(id)))
    : null;
  const uniqueIds = scopeIds ? Array.from(new Set(scopeIds)) : null;

  const { ACTIVE_OR_NEW, ARCHIVE } = statusFilters('object_status');
  const buildWhere = (statusWhere) => {
    if (!uniqueIds || uniqueIds.length === 0) return statusWhere;
    return {
      [Op.and]: [statusWhere, { id: { [Op.in]: uniqueIds } }],
    };
  };

  let [extActiveOrNew, extArchived] = await Promise.all([
    ExtFileExternal.findAll({ where: buildWhere(ACTIVE_OR_NEW) }),
    ExtFileExternal.findAll({ where: buildWhere(ARCHIVE) }),
  ]);

  if (extActiveOrNew.length === 0 && extArchived.length === 0) {
    const fallbackWhere =
      uniqueIds && uniqueIds.length
        ? { id: { [Op.in]: uniqueIds } }
        : undefined;
    const fallbackRows = await ExtFileExternal.findAll({
      where: fallbackWhere,
    });
    const hasStatusValues = fallbackRows.some((row) =>
      normalizeStatus(row.object_status)
    );
    const hasRecognizedStatuses = fallbackRows.some((row) => {
      const status = normalizeStatus(row.object_status);
      return status === 'active' || status === 'new' || status === 'archive';
    });

    if (!hasStatusValues || hasRecognizedStatuses) {
      extActiveOrNew = fallbackRows;
      extArchived = [];
    }
  }

  const knownIdsSet = new Set(
    [...extActiveOrNew, ...extArchived].map((file) => file.id)
  );
  const knownIds = Array.from(knownIdsSet);

  const locals = knownIds.length
    ? await ExtFile.findAll({
        where: { external_id: { [Op.in]: knownIds } },
        paranoid: false,
      })
    : [];
  const localByExternalId = new Map(locals.map((l) => [l.external_id, l]));

  let upserts = 0;
  let restored = 0;
  let softDeletedArchived = 0;
  let softDeletedMissing = 0;
  let createdArchived = 0;
  let softDeletedByStatus = 0;

  const pendingStatusIds =
    uniqueIds && uniqueIds.length
      ? uniqueIds.filter((id) => !knownIdsSet.has(id))
      : [];

  const extStatusExcluded = pendingStatusIds.length
    ? (
        await ExtFileExternal.findAll({
          where: { id: { [Op.in]: pendingStatusIds } },
        })
      ).filter((file) => {
        const status = normalizeStatus(file.object_status);
        return status !== 'active' && status !== 'new' && status !== 'archive';
      })
    : [];

  await sequelize.transaction(async (tx) => {
    for (const file of extActiveOrNew) {
      const local = localByExternalId.get(file.id);
      const desired = {
        module: file.module || null,
        name: file.name || null,
        mime_type: file.mime_type || null,
        size:
          file.size === undefined || file.size === null
            ? null
            : Number(file.size),
        object_status: file.object_status || null,
        date_create: normalizeDate(file.date_create),
        date_update: normalizeDate(file.date_update),
      };
      if (!local) {
        await ExtFile.create(
          {
            external_id: file.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        upserts += 1;
        continue;
      }
      const updates = {};
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        restored += 1;
      }
      if (!equal(local.module, desired.module)) updates.module = desired.module;
      if (!equal(local.name, desired.name)) updates.name = desired.name;
      if (!equal(local.mime_type, desired.mime_type))
        updates.mime_type = desired.mime_type;
      if (!equal(local.size, desired.size)) updates.size = desired.size;
      if (!equal(local.object_status, desired.object_status))
        updates.object_status = desired.object_status;
      if (!equal(local.date_create, desired.date_create))
        updates.date_create = desired.date_create;
      if (!equal(local.date_update, desired.date_update))
        updates.date_update = desired.date_update;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        upserts += 1;
      }
    }

    // Ensure archived rows exist and remain soft-deleted
    createdArchived = await ensureArchivedImported(
      ExtFile,
      extArchived,
      (file) => ({
        module: file.module || null,
        name: file.name || null,
        mime_type: file.mime_type || null,
        size:
          file.size === undefined || file.size === null
            ? null
            : Number(file.size),
        object_status: file.object_status || null,
        date_create: normalizeDate(file.date_create),
        date_update: normalizeDate(file.date_update),
      }),
      actorId,
      tx
    );

    if (extArchived.length) {
      const [archCnt] = await ExtFile.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.in]: extArchived.map((f) => f.id) },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      softDeletedArchived += archCnt;
    }

    if (extStatusExcluded.length) {
      const excludedIds = extStatusExcluded.map((f) => f.id);
      const [inactiveCnt] = await ExtFile.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.in]: excludedIds },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      softDeletedByStatus += inactiveCnt;
    }

    if (!uniqueIds || uniqueIds.length === 0) {
      const [missCnt] = await ExtFile.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: knownIds.length ? knownIds : [null] },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      softDeletedMissing += missCnt;
    }
  });

  const idByExternalId = new Map();
  if (knownIds.length) {
    const refreshed = await ExtFile.findAll({
      where: { external_id: { [Op.in]: knownIds } },
      paranoid: false,
    });
    for (const local of refreshed) {
      idByExternalId.set(local.external_id, local.id);
    }
  }

  return {
    stats: {
      upserts,
      restored,
      createdArchived,
      softDeletedArchived,
      softDeletedMissing,
      softDeletedByStatus,
    },
    idByExternalId,
  };
}

export default { syncExtFiles };
