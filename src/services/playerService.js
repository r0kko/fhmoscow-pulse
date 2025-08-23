import { Op } from 'sequelize';

import {
  Player,
  PlayerRole,
  ClubPlayer,
  TeamPlayer,
  Team,
  Club,
  Season,
} from '../models/index.js';
import {
  Player as ExtPlayer,
  ClubPlayer as ExtClubPlayer,
  TeamPlayer as ExtTeamPlayer,
  TeamPlayerRole as ExtTeamPlayerRole,
} from '../externalModels/index.js';
import sequelize from '../config/database.js';
import logger from '../../logger.js';
import { statusFilters } from '../utils/sync.js';

async function syncExternal(actorId = null) {
  // 1) Roles (no object_status on external)
  const extRoles = await ExtTeamPlayerRole.findAll();
  const roleExtIds = extRoles.map((r) => r.id);
  let roleUpserts = 0;
  let roleSoftDeleted = 0;
  await sequelize.transaction(async (tx) => {
    const locals = roleExtIds.length
      ? await PlayerRole.findAll({
          where: { external_id: { [Op.in]: roleExtIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));
    for (const r of extRoles) {
      const local = localByExt.get(r.id);
      if (!local) {
        await PlayerRole.create(
          { external_id: r.id, created_by: actorId, updated_by: actorId },
          { transaction: tx }
        );
        roleUpserts += 1;
        continue;
      }
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        roleUpserts += 1; // restored
      }
    }
    const [softCnt] = await PlayerRole.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: {
          external_id: { [Op.notIn]: roleExtIds, [Op.ne]: null },
          deletedAt: null,
        },
        transaction: tx,
        paranoid: false,
      }
    );
    roleSoftDeleted = softCnt;
  });

  // 2) Players (respect object_status === 'archive')
  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const [extActive, extArchived] = await Promise.all([
    ExtPlayer.findAll({ where: ACTIVE }),
    ExtPlayer.findAll({ where: ARCHIVE }),
  ]);
  const playerActiveIds = extActive.map((p) => p.id);
  const playerArchivedIds = extArchived.map((p) => p.id);
  const playerKnownIds = Array.from(
    new Set([...playerActiveIds, ...playerArchivedIds])
  );
  let playerUpserts = 0;
  let playerSoftDeletedMissing = 0;
  let playerSoftDeletedArchived = 0;
  await sequelize.transaction(async (tx) => {
    const locals = playerKnownIds.length
      ? await Player.findAll({
          where: { external_id: { [Op.in]: playerKnownIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));

    const equal = (a, b) => {
      if (a == null && b == null) return true;
      if (a instanceof Date || b instanceof Date) {
        const ta = a ? new Date(a).getTime() : null;
        const tb = b ? new Date(b).getTime() : null;
        return ta === tb;
      }
      return a === b;
    };

    for (const p of extActive) {
      const local = localByExt.get(p.id);
      const desired = {
        surname: p.surname,
        name: p.name,
        patronymic: p.patronymic,
        date_of_birth: p.date_of_birth,
        grip: p.grip,
        height: p.height,
        weight: p.weight,
      };
      if (!local) {
        await Player.create(
          {
            external_id: p.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        playerUpserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (!equal(local.surname, desired.surname))
        updates.surname = desired.surname;
      if (!equal(local.name, desired.name)) updates.name = desired.name;
      if (!equal(local.patronymic, desired.patronymic))
        updates.patronymic = desired.patronymic;
      if (!equal(local.date_of_birth, desired.date_of_birth))
        updates.date_of_birth = desired.date_of_birth;
      if (!equal(local.grip, desired.grip)) updates.grip = desired.grip;
      if (!equal(local.height, desired.height)) updates.height = desired.height;
      if (!equal(local.weight, desired.weight)) updates.weight = desired.weight;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) playerUpserts += 1;
    }

    // Soft-delete ARCHIVE
    const [archCnt] = await Player.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: playerArchivedIds }, deletedAt: null },
        transaction: tx,
        paranoid: false,
      }
    );
    playerSoftDeletedArchived = archCnt;

    // Soft-delete missing (not ACTIVE or ARCHIVE)
    if (playerKnownIds.length) {
      const [missCnt] = await Player.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: playerKnownIds, [Op.ne]: null },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      playerSoftDeletedMissing = missCnt;
    }
  });

  // Prepare lookup maps for joins
  const clubPlayers = await ExtClubPlayer.findAll();
  const teamPlayers = await ExtTeamPlayer.findAll();
  const extClubIds = Array.from(
    new Set(clubPlayers.map((cp) => cp.club_id).filter(Boolean))
  );
  const extTeamIds = Array.from(
    new Set(teamPlayers.map((tp) => tp.team_id).filter(Boolean))
  );
  const extPlayerIds = Array.from(
    new Set(
      [
        ...clubPlayers.map((cp) => cp.player_id),
        ...teamPlayers.map((tp) => tp.player_id),
      ].filter(Boolean)
    )
  );
  const extRoleIds = Array.from(
    new Set(clubPlayers.map((cp) => cp.role_id).filter(Boolean))
  );
  const extSeasonIds = Array.from(
    new Set(clubPlayers.map((cp) => cp.season_id).filter(Boolean))
  );

  const [clubs, teams, players, roles, seasons] = await Promise.all([
    extClubIds.length
      ? Club.findAll({
          where: { external_id: { [Op.in]: extClubIds } },
          paranoid: false,
        })
      : [],
    extTeamIds.length
      ? Team.findAll({
          where: { external_id: { [Op.in]: extTeamIds } },
          paranoid: false,
        })
      : [],
    extPlayerIds.length
      ? Player.findAll({
          where: { external_id: { [Op.in]: extPlayerIds } },
          paranoid: false,
        })
      : [],
    extRoleIds.length
      ? PlayerRole.findAll({
          where: { external_id: { [Op.in]: extRoleIds } },
          paranoid: false,
        })
      : [],
    extSeasonIds.length
      ? Season.findAll({
          where: { external_id: { [Op.in]: extSeasonIds } },
          paranoid: false,
        })
      : [],
  ]);
  const clubIdByExt = new Map(clubs.map((c) => [c.external_id, c.id]));
  const teamIdByExt = new Map(teams.map((t) => [t.external_id, t.id]));
  const playerIdByExt = new Map(players.map((p) => [p.external_id, p.id]));
  const roleIdByExt = new Map(roles.map((r) => [r.external_id, r.id]));
  const seasonIdByExt = new Map(seasons.map((s) => [s.external_id, s.id]));

  // 3) ClubPlayers
  let clubPlayerUpserts = 0;
  let clubPlayerSoftDeleted = 0;
  const clubPlayerExtIds = clubPlayers.map((cp) => cp.id);
  const clubPlayerLocals = clubPlayerExtIds.length
    ? await ClubPlayer.findAll({
        where: { external_id: { [Op.in]: clubPlayerExtIds } },
        paranoid: false,
      })
    : [];
  const clubPlayerByExt = new Map(
    clubPlayerLocals.map((x) => [x.external_id, x])
  );
  const clubPlayerIdByExt = new Map(
    clubPlayerLocals.map((x) => [x.external_id, x.id])
  );
  await sequelize.transaction(async (tx) => {
    for (const cp of clubPlayers) {
      const playerId = playerIdByExt.get(cp.player_id);
      if (!playerId) {
        logger.warn(
          'Skip club_player %d: player %d not found or archived',
          cp.id,
          cp.player_id
        );
        continue;
      }
      const desired = {
        club_id: clubIdByExt.get(cp.club_id) || null,
        player_id: playerId,
        role_id: roleIdByExt.get(cp.role_id) || null,
        season_id: seasonIdByExt.get(cp.season_id) || null,
      };
      const local = clubPlayerByExt.get(cp.id);
      if (!local) {
        const created = await ClubPlayer.create(
          {
            external_id: cp.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        clubPlayerUpserts += 1;
        clubPlayerIdByExt.set(cp.id, created.id);
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (local.club_id !== desired.club_id) updates.club_id = desired.club_id;
      if (local.player_id !== desired.player_id)
        updates.player_id = desired.player_id;
      if (local.role_id !== desired.role_id) updates.role_id = desired.role_id;
      if (local.season_id !== desired.season_id)
        updates.season_id = desired.season_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) clubPlayerUpserts += 1;
    }
    const [softCnt] = await ClubPlayer.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: {
          external_id: { [Op.notIn]: clubPlayerExtIds, [Op.ne]: null },
          deletedAt: null,
        },
        transaction: tx,
        paranoid: false,
      }
    );
    clubPlayerSoftDeleted = softCnt;
  });

  // 4) TeamPlayers
  let teamPlayerUpserts = 0;
  let teamPlayerSoftDeleted = 0;
  const teamPlayerExtIds = teamPlayers.map((tp) => tp.id);
  const teamPlayerLocals = teamPlayerExtIds.length
    ? await TeamPlayer.findAll({
        where: { external_id: { [Op.in]: teamPlayerExtIds } },
        paranoid: false,
      })
    : [];
  const teamPlayerByExt = new Map(
    teamPlayerLocals.map((x) => [x.external_id, x])
  );
  await sequelize.transaction(async (tx) => {
    for (const tp of teamPlayers) {
      const teamId = teamIdByExt.get(tp.team_id);
      const playerId = playerIdByExt.get(tp.player_id);
      if (!teamId || !playerId) {
        logger.warn(
          'Skip team_player %d: team %s or player %s not found',
          tp.id,
          String(tp.team_id),
          String(tp.player_id)
        );
        continue;
      }
      const desired = {
        team_id: teamId,
        player_id: playerId,
        club_player_id: clubPlayerIdByExt.get(tp.contract_id) || null,
      };
      const local = teamPlayerByExt.get(tp.id);
      if (!local) {
        await TeamPlayer.create(
          {
            external_id: tp.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        teamPlayerUpserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (local.team_id !== desired.team_id) updates.team_id = desired.team_id;
      if (local.player_id !== desired.player_id)
        updates.player_id = desired.player_id;
      if (local.club_player_id !== desired.club_player_id)
        updates.club_player_id = desired.club_player_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) teamPlayerUpserts += 1;
    }
    const [softCnt] = await TeamPlayer.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: {
          external_id: { [Op.notIn]: teamPlayerExtIds, [Op.ne]: null },
          deletedAt: null,
        },
        transaction: tx,
        paranoid: false,
      }
    );
    teamPlayerSoftDeleted = softCnt;
  });

  logger.info(
    'Player sync: players upserted=%d, softDeleted=%d (archived=%d, missing=%d); roles upserted=%d, softDeleted=%d; clubPlayers upserted=%d, softDeleted=%d; teamPlayers upserted=%d, softDeleted=%d',
    playerUpserts,
    playerSoftDeletedMissing + playerSoftDeletedArchived,
    playerSoftDeletedArchived,
    playerSoftDeletedMissing,
    roleUpserts,
    roleSoftDeleted,
    clubPlayerUpserts,
    clubPlayerSoftDeleted,
    teamPlayerUpserts,
    teamPlayerSoftDeleted
  );

  return {
    players: {
      upserts: playerUpserts,
      softDeletedTotal: playerSoftDeletedMissing + playerSoftDeletedArchived,
      softDeletedArchived: playerSoftDeletedArchived,
      softDeletedMissing: playerSoftDeletedMissing,
    },
    player_roles: { upserts: roleUpserts, softDeletedTotal: roleSoftDeleted },
    club_players: {
      upserts: clubPlayerUpserts,
      softDeletedTotal: clubPlayerSoftDeleted,
    },
    team_players: {
      upserts: teamPlayerUpserts,
      softDeletedTotal: teamPlayerSoftDeleted,
    },
  };
}

async function list(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;

  const whereClause = {};
  if (options.search) {
    const term = `%${options.search}%`;
    whereClause[Op.or] = [
      { surname: { [Op.iLike]: term } },
      { name: { [Op.iLike]: term } },
      { patronymic: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
    ];
  }

  const status = String(options.status || 'ACTIVE').toUpperCase();
  const paranoid = !(status === 'ARCHIVED' || status === 'ALL');
  if (status === 'ARCHIVED') {
    whereClause.deleted_at = { [Op.ne]: null };
  }

  const include = [];
  if (options.includeTeams) include.push({ model: Team, required: false });
  if (options.includeClubs) include.push({ model: Club, required: false });

  return Player.findAndCountAll({
    where: whereClause,
    include,
    paranoid,
    order: [
      ['surname', 'ASC'],
      ['name', 'ASC'],
    ],
    limit,
    offset,
    distinct: true,
  });
}

async function listAll() {
  return Player.findAll({
    order: [
      ['surname', 'ASC'],
      ['name', 'ASC'],
    ],
  });
}

export default { syncExternal, list, listAll };
