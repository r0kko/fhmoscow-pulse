import { Op } from 'sequelize';

import { Club, ClubType } from '../models/index.js';
import { Club as ExtClub } from '../externalModels/index.js';
import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';
import {
  statusFilters,
  ensureArchivedImported,
  buildSinceClause,
  maxTimestamp,
  normalizeSyncOptions,
} from '../utils/sync.js';
import logger from '../../logger.js';

const CLUB_TYPE_ALIAS_YOUTH = 'YOUTH';

function coerceIsMoscow(value) {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return ['1', 'true', 't', 'yes', 'y'].includes(normalized);
}

function normalizeClubName(value) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new ServiceError('invalid_club_name', 400);
  return normalized;
}

async function resolveClubType(typeId) {
  if (!typeId) return null;
  const type = await ClubType.findByPk(typeId);
  if (!type) throw new ServiceError('club_type_not_found', 404);
  return type;
}

async function resolveDefaultClubTypeId(transaction) {
  const type = await ClubType.findOne({
    where: { alias: CLUB_TYPE_ALIAS_YOUTH },
    attributes: ['id'],
    ...(transaction ? { transaction } : {}),
  });
  if (!type) throw new ServiceError('club_type_not_found', 404);
  return type.id;
}

async function listTypes() {
  return ClubType.findAll({ order: [['name', 'ASC']] });
}

async function syncExternal(options = {}) {
  const normalized = normalizeSyncOptions(options);
  let { mode, since, fullResync } = normalized;
  const { actorId } = normalized;

  const { ACTIVE, ARCHIVE } = statusFilters('object_status');

  if (!fullResync) {
    const localMoscowCount = await Club.count({ where: { is_moscow: true } });
    if (!localMoscowCount) {
      try {
        const extMoscowCount = await ExtClub.count({
          where: {
            [Op.and]: [ACTIVE, { is_moscow: { [Op.in]: [true, 1] } }],
          },
        });
        if (extMoscowCount > 0) {
          fullResync = true;
          mode = 'full';
          since = null;
        }
      } catch (err) {
        logger.warn('Club sync fallback check failed: %s', err?.message || err);
      }
    }
  }

  const sinceClause = buildSinceClause(since);

  const attributes = [
    'id',
    'short_name',
    'date_update',
    'date_create',
    'is_moscow',
  ];
  const activeWhere = fullResync ? ACTIVE : { [Op.and]: [ACTIVE, sinceClause] };
  const archiveWhere = fullResync
    ? ARCHIVE
    : { [Op.and]: [ARCHIVE, sinceClause] };

  let [extActive, extArchived] = await Promise.all([
    ExtClub.findAll({ where: activeWhere, attributes }),
    ExtClub.findAll({ where: archiveWhere, attributes }),
  ]);

  if (fullResync && extActive.length === 0 && extArchived.length === 0) {
    extActive = await ExtClub.findAll({ attributes });
    extArchived = [];
  }

  const activeIds = extActive.map((c) => c.id);
  const archivedIds = extArchived.map((c) => c.id);
  const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

  let upserts = 0;
  let affectedArchived = 0;
  let affectedMissing = 0;

  if (knownIds.length) {
    await sequelize.transaction(async (tx) => {
      const defaultClubTypeId = await resolveDefaultClubTypeId(tx);
      const locals = await Club.findAll({
        where: { external_id: { [Op.in]: knownIds } },
        paranoid: false,
        transaction: tx,
      });
      const localByExt = new Map(locals.map((l) => [l.external_id, l]));

      for (const c of extActive) {
        const local = localByExt.get(c.id);
        if (!local) {
          const isMoscow = coerceIsMoscow(c.is_moscow);
          await Club.create(
            {
              external_id: c.id,
              name: c.short_name,
              club_type_id: defaultClubTypeId,
              is_moscow: isMoscow,
              created_by: actorId,
              updated_by: actorId,
            },
            { transaction: tx }
          );
          upserts += 1;
          continue;
        }
        let changed = false;
        if (local.deletedAt) {
          await local.restore({ transaction: tx });
          changed = true;
        }
        const updates = {};
        if (local.name !== c.short_name) updates.name = c.short_name;
        if (!local.club_type_id) updates.club_type_id = defaultClubTypeId;
        const isMoscow = coerceIsMoscow(c.is_moscow);
        if (local.is_moscow !== isMoscow) updates.is_moscow = isMoscow;
        if (Object.keys(updates).length) {
          updates.updated_by = actorId;
          await local.update(updates, { transaction: tx });
          changed = true;
        }
        if (changed) upserts += 1;
      }

      if (extArchived.length) {
        await ensureArchivedImported(
          Club,
          extArchived,
          (c) => ({
            name: c.short_name,
            club_type_id: defaultClubTypeId,
            is_moscow: coerceIsMoscow(c.is_moscow),
          }),
          actorId,
          tx
        );
      }

      if (archivedIds.length) {
        const [archCnt] = await Club.update(
          { deletedAt: new Date(), updated_by: actorId },
          {
            where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
            transaction: tx,
            paranoid: false,
          }
        );
        affectedArchived = archCnt;
      }

      if (fullResync) {
        const [missCnt] = await Club.update(
          { deletedAt: new Date(), updated_by: actorId },
          {
            where: {
              external_id: { [Op.notIn]: knownIds, [Op.ne]: null },
              deletedAt: null,
            },
            transaction: tx,
            paranoid: false,
          }
        );
        affectedMissing = missCnt;
      }
    });
  } else if (fullResync) {
    // Full run with zero known ids → sweep all local records as missing
    const [missCnt] = await Club.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { deletedAt: null, external_id: { [Op.ne]: null } },
        paranoid: false,
      }
    );
    affectedMissing = missCnt;
  }

  const softDeletedTotal = affectedArchived + affectedMissing;
  const cursor = maxTimestamp([...extActive, ...extArchived]);
  logger.info(
    'Club sync (mode=%s): upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
    mode,
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
    cursor,
    mode,
    fullSync: fullResync,
  };
}

async function listAll() {
  return Club.findAll({
    include: [{ model: ClubType, required: false }],
    order: [['name', 'ASC']],
  });
}

/**
 * Paginated list with optional search and eager-loaded teams.
 * @param {Object} options
 * @param {number} [options.page]
 * @param {number} [options.limit]
 * @param {string} [options.search]
 * @param {boolean} [options.includeTeams]
 * @param {boolean} [options.includeGrounds]
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
  const include = [{ model: ClubType, required: false }];
  if (options.includeTeams) {
    const { Team } = await import('../models/index.js');
    include.push({ model: Team, required: false });
  }
  if (options.includeGrounds) {
    const { Ground } = await import('../models/index.js');
    include.push({ model: Ground, required: false });
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

async function createManual(data = {}, actorId = null) {
  const name = normalizeClubName(data.name);
  let clubTypeId = data.club_type_id || null;
  if (clubTypeId) {
    await resolveClubType(clubTypeId);
  } else {
    clubTypeId = await resolveDefaultClubTypeId();
  }
  const club = await Club.create({
    external_id: null,
    name,
    club_type_id: clubTypeId,
    is_moscow: coerceIsMoscow(data.is_moscow),
    created_by: actorId,
    updated_by: actorId,
  });
  return Club.findByPk(club.id, {
    include: [{ model: ClubType, required: false }],
  });
}

async function updateClub(id, data = {}, actorId = null) {
  const club = await Club.findByPk(id);
  if (!club) throw new ServiceError('club_not_found', 404);

  const updates = { updated_by: actorId };
  if (data.name !== undefined) {
    updates.name = normalizeClubName(data.name);
  }
  if (data.club_type_id !== undefined) {
    const clubTypeId = data.club_type_id || null;
    if (!clubTypeId) throw new ServiceError('club_type_not_found', 404);
    await resolveClubType(clubTypeId);
    updates.club_type_id = clubTypeId;
  }
  if (data.is_moscow !== undefined) {
    updates.is_moscow = coerceIsMoscow(data.is_moscow);
  }
  await club.update(updates, { returning: false });
  return Club.findByPk(club.id, {
    include: [{ model: ClubType, required: false }],
  });
}

export default {
  syncExternal,
  listAll,
  list,
  listTypes,
  createManual,
  updateClub,
};
