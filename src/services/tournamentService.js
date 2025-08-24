import { Op } from 'sequelize';

import {
  Tournament,
  TournamentType,
  Stage,
  TournamentGroup,
  TournamentTeam,
  Tour,
  Match,
  Season,
  Team,
  Ground,
} from '../models/index.js';
import {
  Tournament as ExtTournament,
  TournamentType as ExtTournamentType,
  TournamentGroup as ExtTournamentGroup,
  TournamentTeam as ExtTournamentTeam,
  Stage as ExtStage,
  Tour as ExtTour,
  Game as ExtGame,
  Tags as ExtTags,
} from '../externalModels/index.js';
import sequelize from '../config/database.js';
import { moscowToUtc } from '../utils/time.js';
import logger from '../../logger.js';
import { statusFilters, ensureArchivedImported } from '../utils/sync.js';

function emptyStats() {
  return {
    upserts: 0,
    softDeletedTotal: 0,
    softDeletedArchived: 0,
    softDeletedMissing: 0,
  };
}

async function syncTypes(actorId = null) {
  const stats = emptyStats();
  // Respect object_status on external tournament types
  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const [extActive, extArchived] = await Promise.all([
    ExtTournamentType.findAll({ where: ACTIVE }),
    ExtTournamentType.findAll({ where: ARCHIVE }),
  ]);
  const activeIds = extActive.map((t) => t.id);
  const archivedIds = extArchived.map((t) => t.id);
  const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

  // Map tags for both active + archived for name fallback
  const tagIds = Array.from(
    new Set(
      [...extActive, ...extArchived].map((t) => t.tags_id).filter(Boolean)
    )
  );
  const tags = tagIds.length
    ? await ExtTags.findAll({ where: { id: { [Op.in]: tagIds } } })
    : [];
  const tagNameById = new Map(tags.map((t) => [t.id, t.name]));

  await sequelize.transaction(async (tx) => {
    const locals = knownIds.length
      ? await TournamentType.findAll({
          where: { external_id: { [Op.in]: knownIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    // Handle ACTIVE: create/restore/update
    for (const t of extActive) {
      const fullName =
        t.full_name || tagNameById.get(t.tags_id) || `Турнирный тип #${t.id}`;
      const doubleProtocol = !!t.double_protocol;
      const local = localByExt.get(t.id);
      if (!local) {
        await TournamentType.create(
          {
            external_id: t.id,
            name: fullName,
            double_protocol: doubleProtocol,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        stats.upserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (local.name !== fullName) updates.name = fullName;
      if (local.double_protocol !== doubleProtocol)
        updates.double_protocol = doubleProtocol;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) stats.upserts += 1;
    }

    // Ensure archived external types exist locally as soft-deleted
    const createdArchived = await ensureArchivedImported(
      TournamentType,
      extArchived,
      (t) => ({
        name:
          t.full_name || tagNameById.get(t.tags_id) || `Турнирный тип #${t.id}`,
        double_protocol: !!t.double_protocol,
      }),
      actorId,
      tx
    );
    stats.upserts += createdArchived;

    // Soft-delete explicitly archived
    const [archCnt] = await TournamentType.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
        paranoid: false,
        transaction: tx,
      }
    );
    stats.softDeletedArchived = archCnt;

    // Soft delete missing (not in ACTIVE or ARCHIVE)
    if (knownIds.length) {
      const [missCnt] = await TournamentType.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: knownIds, [Op.ne]: null },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      stats.softDeletedMissing = missCnt;
    }
    stats.softDeletedTotal =
      stats.softDeletedArchived + stats.softDeletedMissing;
  });
  return stats;
}

async function syncTournaments(actorId = null) {
  const stats = emptyStats();
  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const [extActive, extArchived] = await Promise.all([
    ExtTournament.findAll({ where: ACTIVE }),
    ExtTournament.findAll({ where: ARCHIVE }),
  ]);
  const activeIds = extActive.map((t) => t.id);
  const archivedIds = extArchived.map((t) => t.id);
  const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

  // Preload season and type mappings
  const seasonExtIds = Array.from(
    new Set(
      [...extActive, ...extArchived].map((t) => t.season_id).filter(Boolean)
    )
  );
  const typeExtIds = Array.from(
    new Set(
      [...extActive, ...extArchived].map((t) => t.type_id).filter(Boolean)
    )
  );
  const [seasons, types] = await Promise.all([
    seasonExtIds.length
      ? Season.findAll({ where: { external_id: { [Op.in]: seasonExtIds } } })
      : [],
    typeExtIds.length
      ? TournamentType.findAll({
          where: { external_id: { [Op.in]: typeExtIds } },
        })
      : [],
  ]);
  const seasonIdByExt = new Map(seasons.map((s) => [s.external_id, s.id]));
  const typeIdByExt = new Map(types.map((t) => [t.external_id, t.id]));

  await sequelize.transaction(async (tx) => {
    const locals = knownIds.length
      ? await Tournament.findAll({
          where: { external_id: { [Op.in]: knownIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    for (const t of extActive) {
      const desired = {
        name: t.short_name || t.full_name || `Турнир #${t.id}`,
        full_name: t.full_name || null,
        birth_year: t.year_of_birth || null,
        season_id: seasonIdByExt.get(t.season_id) || null,
        type_id: typeIdByExt.get(t.type_id) || null,
      };
      const local = localByExt.get(t.id);
      if (!local) {
        await Tournament.create(
          {
            external_id: t.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        stats.upserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (local.name !== desired.name) updates.name = desired.name;
      if (local.full_name !== desired.full_name)
        updates.full_name = desired.full_name;
      if (local.birth_year !== desired.birth_year)
        updates.birth_year = desired.birth_year;
      if (local.season_id !== desired.season_id)
        updates.season_id = desired.season_id;
      if (local.type_id !== desired.type_id) updates.type_id = desired.type_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) stats.upserts += 1;
    }

    // Ensure archived external tournaments exist locally (as soft-deleted) even on first import
    const createdArchived = await ensureArchivedImported(
      Tournament,
      extArchived,
      (t) => ({
        name: t.short_name || t.full_name || `Турнир #${t.id}`,
        full_name: t.full_name || null,
        birth_year: t.year_of_birth || null,
        season_id: seasonIdByExt.get(t.season_id) || null,
        type_id: typeIdByExt.get(t.type_id) || null,
      }),
      actorId,
      tx
    );
    stats.upserts += createdArchived;

    const [archCnt] = await Tournament.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
        paranoid: false,
        transaction: tx,
      }
    );
    stats.softDeletedArchived = archCnt;

    if (knownIds.length) {
      const [missCnt] = await Tournament.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: knownIds, [Op.ne]: null },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      stats.softDeletedMissing = missCnt;
    }
    stats.softDeletedTotal =
      stats.softDeletedArchived + stats.softDeletedMissing;
  });
  return stats;
}

async function syncStages(actorId = null) {
  const stats = emptyStats();
  const extStages = await ExtStage.findAll();
  const knownIds = extStages.map((s) => s.id);
  const tournamentExtIds = Array.from(
    new Set(extStages.map((s) => s.tournament_id).filter(Boolean))
  );
  const tournaments = tournamentExtIds.length
    ? await Tournament.findAll({
        where: { external_id: { [Op.in]: tournamentExtIds } },
        paranoid: false,
      })
    : [];
  const tourIdByExt = new Map(tournaments.map((t) => [t.external_id, t.id]));

  await sequelize.transaction(async (tx) => {
    const locals = knownIds.length
      ? await Stage.findAll({
          where: { external_id: { [Op.in]: knownIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    for (const s of extStages) {
      const desired = {
        tournament_id: tourIdByExt.get(s.tournament_id) || null,
      };
      const local = localByExt.get(s.id);
      if (!local) {
        await Stage.create(
          {
            external_id: s.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        stats.upserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      if (local.tournament_id !== desired.tournament_id) {
        await local.update(
          { tournament_id: desired.tournament_id, updated_by: actorId },
          { transaction: tx }
        );
        changed = true;
      }
      if (changed) stats.upserts += 1;
    }

    if (knownIds.length) {
      const [missCnt] = await Stage.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: knownIds, [Op.ne]: null },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      stats.softDeletedMissing = missCnt;
      stats.softDeletedTotal = missCnt;
    }
  });
  return stats;
}

async function syncGroups(actorId = null) {
  const stats = emptyStats();
  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const [extActive, extArchived] = await Promise.all([
    ExtTournamentGroup.findAll({ where: ACTIVE }),
    ExtTournamentGroup.findAll({ where: ARCHIVE }),
  ]);
  const activeIds = extActive.map((g) => g.id);
  const archivedIds = extArchived.map((g) => g.id);
  const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

  const tournamentExtIds = Array.from(
    new Set(
      [...extActive, ...extArchived].map((g) => g.tournament_id).filter(Boolean)
    )
  );
  const stageExtIds = Array.from(
    new Set(
      [...extActive, ...extArchived].map((g) => g.stage_id).filter(Boolean)
    )
  );
  const [tournaments, stages] = await Promise.all([
    tournamentExtIds.length
      ? Tournament.findAll({
          where: { external_id: { [Op.in]: tournamentExtIds } },
          paranoid: false,
        })
      : [],
    stageExtIds.length
      ? Stage.findAll({
          where: { external_id: { [Op.in]: stageExtIds } },
          paranoid: false,
        })
      : [],
  ]);
  const tourIdByExt = new Map(tournaments.map((t) => [t.external_id, t.id]));
  const stageIdByExt = new Map(stages.map((s) => [s.external_id, s.id]));

  await sequelize.transaction(async (tx) => {
    const locals = knownIds.length
      ? await TournamentGroup.findAll({
          where: { external_id: { [Op.in]: knownIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    for (const g of extActive) {
      const desired = {
        name: g.name || null,
        tournament_id: tourIdByExt.get(g.tournament_id) || null,
        stage_id: stageIdByExt.get(g.stage_id) || null,
      };
      const local = localByExt.get(g.id);
      if (!local) {
        await TournamentGroup.create(
          {
            external_id: g.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        stats.upserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (local.name !== desired.name) updates.name = desired.name;
      if (local.tournament_id !== desired.tournament_id)
        updates.tournament_id = desired.tournament_id;
      if (local.stage_id !== desired.stage_id)
        updates.stage_id = desired.stage_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) stats.upserts += 1;
    }

    // Ensure archived external groups exist locally (as soft-deleted) on first import
    const createdArchivedGroups = await ensureArchivedImported(
      TournamentGroup,
      extArchived,
      (g) => ({
        name: g.name || null,
        tournament_id: tourIdByExt.get(g.tournament_id) || null,
        stage_id: stageIdByExt.get(g.stage_id) || null,
      }),
      actorId,
      tx
    );
    stats.upserts += createdArchivedGroups;

    const [archCnt] = await TournamentGroup.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
        paranoid: false,
        transaction: tx,
      }
    );
    stats.softDeletedArchived = archCnt;

    if (knownIds.length) {
      const [missCnt] = await TournamentGroup.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: knownIds, [Op.ne]: null },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      stats.softDeletedMissing = missCnt;
    }
    stats.softDeletedTotal =
      stats.softDeletedArchived + stats.softDeletedMissing;
  });
  return stats;
}

async function syncTournamentTeams(actorId = null) {
  const stats = emptyStats();
  const extTt = await ExtTournamentTeam.findAll();
  const knownIds = extTt.map((r) => r.id);

  const tournamentExtIds = Array.from(
    new Set(extTt.map((r) => r.tournament_id).filter(Boolean))
  );
  const groupExtIds = Array.from(
    new Set(extTt.map((r) => r.tournament_group_id).filter(Boolean))
  );
  const teamExtIds = Array.from(
    new Set(extTt.map((r) => r.team_id).filter(Boolean))
  );
  const [tournaments, groups, teams] = await Promise.all([
    tournamentExtIds.length
      ? Tournament.findAll({
          where: { external_id: { [Op.in]: tournamentExtIds } },
          paranoid: false,
        })
      : [],
    groupExtIds.length
      ? TournamentGroup.findAll({
          where: { external_id: { [Op.in]: groupExtIds } },
          paranoid: false,
        })
      : [],
    teamExtIds.length
      ? Team.findAll({
          where: { external_id: { [Op.in]: teamExtIds } },
          paranoid: false,
        })
      : [],
  ]);
  const tourIdByExt = new Map(tournaments.map((t) => [t.external_id, t.id]));
  const groupIdByExt = new Map(groups.map((g) => [g.external_id, g.id]));
  const teamIdByExt = new Map(teams.map((t) => [t.external_id, t.id]));

  await sequelize.transaction(async (tx) => {
    const locals = knownIds.length
      ? await TournamentTeam.findAll({
          where: { external_id: { [Op.in]: knownIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    for (const r of extTt) {
      const desired = {
        tournament_id: tourIdByExt.get(r.tournament_id) || null,
        tournament_group_id: groupIdByExt.get(r.tournament_group_id) || null,
        team_id: teamIdByExt.get(r.team_id) || null,
      };
      const local = localByExt.get(r.id);
      if (!local) {
        await TournamentTeam.create(
          {
            external_id: r.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        stats.upserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (local.tournament_id !== desired.tournament_id)
        updates.tournament_id = desired.tournament_id;
      if (local.tournament_group_id !== desired.tournament_group_id)
        updates.tournament_group_id = desired.tournament_group_id;
      if (local.team_id !== desired.team_id) updates.team_id = desired.team_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) stats.upserts += 1;
    }

    if (knownIds.length) {
      const [missCnt] = await TournamentTeam.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: knownIds, [Op.ne]: null },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      stats.softDeletedMissing = missCnt;
      stats.softDeletedTotal = missCnt;
    }
  });
  return stats;
}

async function syncExternal(actorId = null) {
  try {
    const typeStats = await syncTypes(actorId);
    const tournamentStats = await syncTournaments(actorId);
    const stageStats = await syncStages(actorId);
    const groupStats = await syncGroups(actorId);
    const ttStats = await syncTournamentTeams(actorId);
    const tourStats = await syncTours(actorId);
    const gameStats = await syncGames(actorId);
    logger.info(
      'Tournament sync: types(upserted=%d, softDeleted=%d); tournaments(upserted=%d, softDeleted=%d); stages(upserted=%d, softDeleted=%d); groups(upserted=%d, softDeleted=%d); tournamentTeams(upserted=%d, softDeleted=%d); tours(upserted=%d, softDeleted=%d); games(upserted=%d, softDeleted=%d)',
      typeStats.upserts,
      typeStats.softDeletedTotal,
      tournamentStats.upserts,
      tournamentStats.softDeletedTotal,
      stageStats.upserts,
      stageStats.softDeletedTotal,
      groupStats.upserts,
      groupStats.softDeletedTotal,
      ttStats.upserts,
      ttStats.softDeletedTotal,
      tourStats.upserts,
      tourStats.softDeletedTotal,
      gameStats.upserts,
      gameStats.softDeletedTotal
    );
    return {
      tournament_types: typeStats,
      tournaments: tournamentStats,
      stages: stageStats,
      groups: groupStats,
      tournament_teams: ttStats,
      tours: tourStats,
      games: gameStats,
    };
  } catch (err) {
    logger.error('Tournament sync failed: %s', err.stack || err);
    throw err;
  }
}

export default {
  syncExternal,
};

// New sync steps for tours and games
async function syncTours(actorId = null) {
  const stats = emptyStats();
  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const [extActive, extArchived] = await Promise.all([
    ExtTour.findAll({ where: ACTIVE }),
    ExtTour.findAll({ where: ARCHIVE }),
  ]);
  const activeIds = extActive.map((r) => r.id);
  const archivedIds = extArchived.map((r) => r.id);
  const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

  // Preload local references: tournaments, groups, stages (via group)
  const tournamentExtIds = Array.from(
    new Set(
      [...extActive, ...extArchived].map((t) => t.tournament_id).filter(Boolean)
    )
  );
  const groupExtIds = Array.from(
    new Set(
      [...extActive, ...extArchived]
        .map((t) => t.tournament_group_id)
        .filter(Boolean)
    )
  );
  const [tournaments, groups] = await Promise.all([
    tournamentExtIds.length
      ? Tournament.findAll({
          where: { external_id: { [Op.in]: tournamentExtIds } },
          paranoid: false,
        })
      : [],
    groupExtIds.length
      ? TournamentGroup.findAll({
          where: { external_id: { [Op.in]: groupExtIds } },
          include: [Stage],
          paranoid: false,
        })
      : [],
  ]);
  const tournamentIdByExt = new Map(
    tournaments.map((t) => [t.external_id, t.id])
  );
  const groupByExt = new Map(groups.map((g) => [g.external_id, g]));

  await sequelize.transaction(async (tx) => {
    const locals = knownIds.length
      ? await Tour.findAll({
          where: { external_id: { [Op.in]: knownIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    for (const t of extActive) {
      const group = groupByExt.get(t.tournament_group_id);
      const desired = {
        name: t.name || null,
        date_start: moscowToUtc(t.date_start),
        date_end: moscowToUtc(t.date_end),
        tournament_id: tournamentIdByExt.get(t.tournament_id) || null,
        tournament_group_id: group?.id || null,
        stage_id: group?.stage_id || null,
      };
      const local = localByExt.get(t.id);
      if (!local) {
        await Tour.create(
          {
            external_id: t.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        stats.upserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (local.name !== desired.name) updates.name = desired.name;
      if (
        +new Date(local.date_start || 0) !== +new Date(desired.date_start || 0)
      )
        updates.date_start = desired.date_start;
      if (+new Date(local.date_end || 0) !== +new Date(desired.date_end || 0))
        updates.date_end = desired.date_end;
      if (local.tournament_id !== desired.tournament_id)
        updates.tournament_id = desired.tournament_id;
      if (local.tournament_group_id !== desired.tournament_group_id)
        updates.tournament_group_id = desired.tournament_group_id;
      if (local.stage_id !== desired.stage_id)
        updates.stage_id = desired.stage_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) stats.upserts += 1;
    }

    // Ensure archived external tours exist locally as soft-deleted
    const createdArchived = await ensureArchivedImported(
      Tour,
      extArchived,
      (t) => {
        const group = groupByExt.get(t.tournament_group_id);
        return {
          name: t.name || null,
          date_start: moscowToUtc(t.date_start),
          date_end: moscowToUtc(t.date_end),
          tournament_id: tournamentIdByExt.get(t.tournament_id) || null,
          tournament_group_id: group?.id || null,
          stage_id: group?.stage_id || null,
        };
      },
      actorId,
      tx
    );
    stats.upserts += createdArchived;

    const [archCnt] = await Tour.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
        paranoid: false,
        transaction: tx,
      }
    );
    stats.softDeletedArchived = archCnt;

    if (knownIds.length) {
      const [missCnt] = await Tour.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: knownIds, [Op.ne]: null },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      stats.softDeletedMissing = missCnt;
    }
    stats.softDeletedTotal =
      (stats.softDeletedArchived || 0) + (stats.softDeletedMissing || 0);
  });

  return stats;
}

async function syncGames(actorId = null) {
  const stats = emptyStats();
  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const [extActive, extArchived] = await Promise.all([
    ExtGame.findAll({ where: ACTIVE }),
    ExtGame.findAll({ where: ARCHIVE }),
  ]);
  const activeIds = extActive.map((g) => g.id);
  const archivedIds = extArchived.map((g) => g.id);
  const knownIds = Array.from(new Set([...activeIds, ...archivedIds]));

  // Collect fk sets
  const tourExtIds = Array.from(
    new Set(
      [...extActive, ...extArchived].map((g) => g.tour_id).filter(Boolean)
    )
  );
  const teamExtIds = Array.from(
    new Set(
      [...extActive, ...extArchived]
        .flatMap((g) => [g.team1_id, g.team2_id])
        .filter(Boolean)
    )
  );
  const stadiumExtIds = Array.from(
    new Set(
      [...extActive, ...extArchived].map((g) => g.stadium_id).filter(Boolean)
    )
  );

  // Preload local refs
  const [tours, teams, grounds] = await Promise.all([
    tourExtIds.length
      ? Tour.findAll({
          where: { external_id: { [Op.in]: tourExtIds } },
          paranoid: false,
        })
      : [],
    teamExtIds.length
      ? Team.findAll({
          where: { external_id: { [Op.in]: teamExtIds } },
          paranoid: false,
        })
      : [],
    stadiumExtIds.length
      ? Ground.findAll({
          where: { external_id: { [Op.in]: stadiumExtIds } },
          paranoid: false,
        })
      : [],
  ]);
  const tourByExt = new Map(tours.map((t) => [t.external_id, t]));
  const teamIdByExt = new Map(teams.map((t) => [t.external_id, t.id]));
  const groundIdByExt = new Map(grounds.map((g) => [g.external_id, g.id]));

  // Preload tournaments to derive season_id for matches via tour.tournament_id
  const tournamentIds = Array.from(
    new Set(tours.map((t) => t.tournament_id).filter(Boolean))
  );
  const tournaments = tournamentIds.length
    ? await Tournament.findAll({
        where: { id: { [Op.in]: tournamentIds } },
        paranoid: false,
      })
    : [];
  const seasonIdByTournamentId = new Map(
    tournaments.map((t) => [t.id, t.season_id])
  );

  await sequelize.transaction(async (tx) => {
    const locals = knownIds.length
      ? await Match.findAll({
          where: { external_id: { [Op.in]: knownIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    for (const g of extActive) {
      const t = tourByExt.get(g.tour_id);
      const desired = {
        date_start: moscowToUtc(g.date_start),
        tour_id: t?.id || null,
        tournament_id: t?.tournament_id || null,
        stage_id: t?.stage_id || null,
        tournament_group_id: t?.tournament_group_id || null,
        season_id: t?.tournament_id
          ? seasonIdByTournamentId.get(t.tournament_id) || null
          : null,
        ground_id: groundIdByExt.get(g.stadium_id) || null,
        team1_id: teamIdByExt.get(g.team1_id) || null,
        team2_id: teamIdByExt.get(g.team2_id) || null,
      };
      const local = localByExt.get(g.id);
      if (!local) {
        await Match.create(
          {
            external_id: g.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        stats.upserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (
        +new Date(local.date_start || 0) !== +new Date(desired.date_start || 0)
      )
        updates.date_start = desired.date_start;
      if (local.tour_id !== desired.tour_id) updates.tour_id = desired.tour_id;
      if (local.tournament_id !== desired.tournament_id)
        updates.tournament_id = desired.tournament_id;
      if (local.stage_id !== desired.stage_id)
        updates.stage_id = desired.stage_id;
      if (local.tournament_group_id !== desired.tournament_group_id)
        updates.tournament_group_id = desired.tournament_group_id;
      if (local.ground_id !== desired.ground_id)
        updates.ground_id = desired.ground_id;
      if (local.team1_id !== desired.team1_id)
        updates.team1_id = desired.team1_id;
      if (local.team2_id !== desired.team2_id)
        updates.team2_id = desired.team2_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) stats.upserts += 1;
    }

    // Ensure archived external games exist locally as soft-deleted
    const createdArchived = await ensureArchivedImported(
      Match,
      extArchived,
      (g) => {
        const t = tourByExt.get(g.tour_id);
        return {
          date_start: moscowToUtc(g.date_start),
          tour_id: t?.id || null,
          tournament_id: t?.tournament_id || null,
          stage_id: t?.stage_id || null,
          tournament_group_id: t?.tournament_group_id || null,
          season_id: t?.tournament_id
            ? seasonIdByTournamentId.get(t.tournament_id) || null
            : null,
          ground_id: groundIdByExt.get(g.stadium_id) || null,
          team1_id: teamIdByExt.get(g.team1_id) || null,
          team2_id: teamIdByExt.get(g.team2_id) || null,
        };
      },
      actorId,
      tx
    );
    stats.upserts += createdArchived;

    const [archCnt] = await Match.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: archivedIds }, deletedAt: null },
        paranoid: false,
        transaction: tx,
      }
    );
    stats.softDeletedArchived = archCnt;

    if (knownIds.length) {
      const [missCnt] = await Match.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: knownIds, [Op.ne]: null },
            deletedAt: null,
          },
          paranoid: false,
          transaction: tx,
        }
      );
      stats.softDeletedMissing = missCnt;
    }
    stats.softDeletedTotal =
      (stats.softDeletedArchived || 0) + (stats.softDeletedMissing || 0);
  });

  return stats;
}
