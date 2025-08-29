import { Op } from 'sequelize';

import { Team, User, UserTeam, Club } from '../models/index.js';
import { Team as ExtTeam } from '../externalModels/index.js';
import ServiceError from '../errors/ServiceError.js';
import sequelize from '../config/database.js';
import { statusFilters, ensureArchivedImported } from '../utils/sync.js';
import logger from '../../logger.js';

async function syncExternal(actorId = null) {
  // Pull ACTIVE and ARCHIVE sets explicitly; tolerant to case/whitespace.
  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const [extActive, extArchived] = await Promise.all([
    ExtTeam.findAll({ where: ACTIVE }),
    ExtTeam.findAll({ where: ARCHIVE }),
  ]);
  const activeIds = extActive.map((t) => t.id);
  const archivedIds = extArchived.map((t) => t.id);
  const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

  let upserts = 0;
  let affectedMissing = 0;
  let affectedArchived = 0;

  await sequelize.transaction(async (tx) => {
    // Preload mapping of external club_id -> local club UUID
    const extClubIds = Array.from(
      new Set(
        [
          ...extActive.map((t) => t.club_id),
          ...extArchived.map((t) => t.club_id),
        ].filter(Boolean)
      )
    );
    const clubs = extClubIds.length
      ? await Club.findAll({
          where: { external_id: { [Op.in]: extClubIds } },
          transaction: tx,
          paranoid: false,
        })
      : [];
    const clubIdByExtId = new Map(clubs.map((c) => [c.external_id, c.id]));

    // Load existing local teams for known external IDs
    const locals = await Team.findAll({
      where: { external_id: { [Op.in]: knownIds } },
      paranoid: false,
      transaction: tx,
    });
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    // Handle ACTIVE: create if missing, restore if soft-deleted, update only when changed
    for (const t of extActive) {
      const local = localByExt.get(t.id);
      const desired = {
        name: t.short_name,
        birth_year: t.year,
        club_id: clubIdByExtId.get(t.club_id) || null,
      };
      if (!local) {
        await Team.create(
          {
            external_id: t.id,
            ...desired,
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
      if (local.name !== desired.name) updates.name = desired.name;
      if (local.birth_year !== desired.birth_year)
        updates.birth_year = desired.birth_year;
      if (local.club_id !== desired.club_id) updates.club_id = desired.club_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) upserts += 1;
    }

    // Ensure archived external teams exist locally (soft-deleted) to stabilize IDs
    await ensureArchivedImported(
      Team,
      extArchived,
      (t) => ({
        name: t.short_name,
        birth_year: t.year,
        club_id: clubIdByExtId.get(t.club_id) || null,
      }),
      actorId,
      tx
    );

    // Soft-delete explicitly archived
    const [archCnt] = await Team.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
        transaction: tx,
        paranoid: false,
      }
    );
    affectedArchived = archCnt;

    // Soft-delete missing (not in ACTIVE or ARCHIVE)
    if (knownIds.length) {
      const [missCnt] = await Team.update(
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
  const softDeletedTotal = affectedMissing + affectedArchived;
  logger.info(
    'Team sync: upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
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
  };
}

async function listAll() {
  return Team.findAll({ order: [['name', 'ASC']] });
}

/**
 * Paginated teams with optional search/filters and Club include.
 * @param {Object} options
 * @param {number} [options.page]
 * @param {number} [options.limit]
 * @param {string} [options.search]
 * @param {string} [options.club_id] - UUID or 'none' for teams without club
 * @param {number|string} [options.birth_year]
 * @param {string} [options.status] - 'ACTIVE' (default), 'ARCHIVED', 'ALL'
 * @param {boolean} [options.includeGrounds]
 */
async function list(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;
  const { Op } = await import('sequelize');
  const where = {};

  // Text search by team name
  if (options.search) {
    const term = `%${options.search}%`;
    where.name = { [Op.iLike]: term };
  }
  // Club filter: explicit 'none' maps to NULL
  if (typeof options.club_id !== 'undefined' && options.club_id !== '') {
    where.club_id = options.club_id === 'none' ? null : options.club_id;
  }
  // Birth year exact match
  if (options.birth_year) where.birth_year = parseInt(options.birth_year, 10);

  // Status filter via paranoid/where on deleted_at
  const status = String(options.status || 'ACTIVE').toUpperCase();
  const paranoid = !(status === 'ARCHIVED' || status === 'ALL');
  if (status === 'ARCHIVED') {
    // Include only soft-deleted
    where.deleted_at = { [Op.ne]: null };
  }

  const include = [Club];
  if (options.includeGrounds) {
    const { Ground } = await import('../models/index.js');
    include.push(Ground);
  }
  return Team.findAndCountAll({
    include,
    where,
    paranoid,
    order: [
      ['name', 'ASC'],
      ['birth_year', 'ASC'],
    ],
    limit,
    offset,
  });
}

async function listUserTeams(userId) {
  const user = await User.findByPk(userId, { include: [Team] });
  if (!user) throw new ServiceError('user_not_found', 404);
  return user.Teams || [];
}

async function addUserTeam(userId, teamId, actorId) {
  const [user, team] = await Promise.all([
    User.findByPk(userId),
    Team.findByPk(teamId),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!team) throw new ServiceError('team_not_found', 404);
  // Handle soft-deleted link: restore instead of creating duplicate
  const existing = await UserTeam.findOne({
    where: { user_id: userId, team_id: teamId },
    paranoid: false,
  });
  if (existing) {
    if (existing.deletedAt) await existing.restore();
    await existing.update({ updated_by: actorId });
    return;
  }
  await user.addTeam(team, {
    through: { created_by: actorId, updated_by: actorId },
  });
}

async function removeUserTeam(userId, teamId, actorId = null) {
  const [user, team] = await Promise.all([
    User.findByPk(userId),
    Team.findByPk(teamId),
  ]);
  if (!user) throw new ServiceError('user_not_found', 404);
  if (!team) throw new ServiceError('team_not_found', 404);
  const link = await UserTeam.findOne({
    where: { user_id: userId, team_id: teamId },
  });
  if (link) {
    await link.update({ updated_by: actorId });
  }
  await user.removeTeam(team);
}

export default {
  syncExternal,
  listAll,
  list,
  listUserTeams,
  addUserTeam,
  removeUserTeam,
};

// New helper for team-centric staff listing
async function listTeamUsers(teamId) {
  const team = await Team.findByPk(teamId, {
    include: [
      {
        model: User,
        through: { attributes: [] },
        required: false,
      },
    ],
  });
  if (!team) throw new ServiceError('team_not_found', 404);
  return team.Users || [];
}

export { listTeamUsers };

// Batched helper: get users for multiple teams to avoid N+1 queries
async function listUsersForTeams(teamIds = []) {
  if (!teamIds || teamIds.length === 0) return new Map();
  const teams = await Team.findAll({
    where: { id: { [Op.in]: teamIds } },
    include: [
      {
        model: User,
        through: { attributes: [] },
        required: false,
      },
    ],
  });
  const map = new Map();
  for (const t of teams) {
    const plain = typeof t.get === 'function' ? t.get({ plain: true }) : t;
    map.set(plain.id, plain.Users || []);
  }
  return map;
}

export { listUsersForTeams };
