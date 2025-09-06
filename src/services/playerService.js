import { Op } from 'sequelize';
import { QueryTypes } from 'sequelize';

import {
  Club,
  ClubPlayer,
  Player,
  PlayerRole,
  Season,
  Team,
  TeamPlayer,
} from '../models/index.js';
import {
  ClubPlayer as ExtClubPlayer,
  Player as ExtPlayer,
  TeamPlayer as ExtTeamPlayer,
  TeamPlayerRole as ExtTeamPlayerRole,
} from '../externalModels/index.js';
import sequelize from '../config/database.js';
import logger from '../../logger.js';
import { ensureArchivedImported, statusFilters } from '../utils/sync.js';

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
      const desired = { name: r.name || null };
      if (!local) {
        await PlayerRole.create(
          {
            external_id: r.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        roleUpserts += 1;
        continue;
      }
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        roleUpserts += 1; // restored
      }
      const updates = {};
      if (local.name !== desired.name) updates.name = desired.name;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        roleUpserts += 1;
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
  let [extActive, extArchived] = await Promise.all([
    ExtPlayer.findAll({ where: ACTIVE }),
    ExtPlayer.findAll({ where: ARCHIVE }),
  ]);
  // Fallback: if external table returns nothing for status, treat all as ACTIVE
  if (extActive.length === 0 && extArchived.length === 0) {
    extActive = await ExtPlayer.findAll();
    extArchived = [];
  }
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

    // Ensure archived external players exist locally (soft-deleted) to stabilize IDs
    await ensureArchivedImported(
      Player,
      extArchived,
      (p) => ({
        surname: p.surname,
        name: p.name,
        patronymic: p.patronymic,
        date_of_birth: p.date_of_birth,
        grip: p.grip,
        height: p.height,
        weight: p.weight,
      }),
      actorId,
      tx
    );

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

  // Prepare lookup maps for joins (use ACTIVE + ARCHIVE for membership tables)
  const { ACTIVE: CP_ACTIVE, ARCHIVE: CP_ARCHIVE } =
    statusFilters('object_status');
  const { ACTIVE: TP_ACTIVE, ARCHIVE: TP_ARCHIVE } =
    statusFilters('object_status');
  let [clubPlayers, clubPlayersArchived, teamPlayers, teamPlayersArchived] =
    await Promise.all([
      ExtClubPlayer.findAll({ where: CP_ACTIVE }),
      ExtClubPlayer.findAll({ where: CP_ARCHIVE }),
      ExtTeamPlayer.findAll({ where: TP_ACTIVE }),
      ExtTeamPlayer.findAll({ where: TP_ARCHIVE }),
    ]);

  // Fallback: if the external table has no object_status column/data,
  // treat all rows as ACTIVE to avoid accidental mass soft-delete.
  if (clubPlayers.length === 0 && clubPlayersArchived.length === 0) {
    clubPlayers = await ExtClubPlayer.findAll();
    clubPlayersArchived = [];
  }
  if (teamPlayers.length === 0 && teamPlayersArchived.length === 0) {
    teamPlayers = await ExtTeamPlayer.findAll();
    teamPlayersArchived = [];
  }

  const extClubIds = Array.from(
    new Set(
      [...clubPlayers, ...clubPlayersArchived]
        .map((cp) => cp.club_id)
        .filter(Boolean)
    )
  );
  const extTeamIds = Array.from(
    new Set(
      [...teamPlayers, ...teamPlayersArchived]
        .map((tp) => tp.team_id)
        .filter(Boolean)
    )
  );
  const extPlayerIds = Array.from(
    new Set(
      [
        ...clubPlayers.map((cp) => cp.player_id),
        ...clubPlayersArchived.map((cp) => cp.player_id),
        ...teamPlayers.map((tp) => tp.player_id),
        ...teamPlayersArchived.map((tp) => tp.player_id),
      ].filter(Boolean)
    )
  );
  const extRoleIds = Array.from(
    new Set(
      [...clubPlayers, ...clubPlayersArchived]
        .map((cp) => cp.role_id)
        .filter(Boolean)
    )
  );
  const extSeasonIds = Array.from(
    new Set(
      [...clubPlayers, ...clubPlayersArchived]
        .map((cp) => cp.season_id)
        .filter(Boolean)
    )
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
  let clubPlayerSoftDeletedMissing = 0;
  let clubPlayerSoftDeletedArchived = 0;
  const clubPlayerActiveIds = clubPlayers.map((cp) => cp.id);
  const clubPlayerArchivedIds = clubPlayersArchived.map((cp) => cp.id);
  const clubPlayerKnownIds = Array.from(
    new Set([...clubPlayerActiveIds, ...clubPlayerArchivedIds])
  );
  const clubPlayerLocals = clubPlayerKnownIds.length
    ? await ClubPlayer.findAll({
        where: { external_id: { [Op.in]: clubPlayerKnownIds } },
        paranoid: false,
      })
    : [];
  const clubPlayerByExt = new Map(
    clubPlayerLocals.map((x) => [x.external_id, x])
  );
  // Track season_id for each external club_player id, including newly created/updated in this sync
  const clubPlayerSeasonByExt = new Map(
    clubPlayerLocals.map((x) => [x.external_id, x.season_id || null])
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
        number: typeof cp.number === 'number' ? cp.number : null,
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
        clubPlayerSeasonByExt.set(cp.id, desired.season_id || null);
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
      if (local.number !== desired.number) updates.number = desired.number;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        if (Object.prototype.hasOwnProperty.call(updates, 'season_id')) {
          clubPlayerSeasonByExt.set(cp.id, updates.season_id || null);
        }
        changed = true;
      }
      if (changed) clubPlayerUpserts += 1;
    }
    // Ensure archived membership rows exist as soft-deleted
    const createdArchivedCp = await ensureArchivedImported(
      ClubPlayer,
      clubPlayersArchived,
      (cp) => ({
        club_id: clubIdByExt.get(cp.club_id) || null,
        player_id: playerIdByExt.get(cp.player_id) || null,
        role_id: roleIdByExt.get(cp.role_id) || null,
        season_id: seasonIdByExt.get(cp.season_id) || null,
        number: typeof cp.number === 'number' ? cp.number : null,
      }),
      actorId,
      tx
    );
    clubPlayerUpserts += createdArchivedCp;

    // Soft-delete archived
    const [archCpCnt] = await ClubPlayer.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: {
          external_id: { [Op.in]: clubPlayerArchivedIds },
          deletedAt: null,
        },
        transaction: tx,
        paranoid: false,
      }
    );
    clubPlayerSoftDeletedArchived = archCpCnt;

    // Soft-delete missing
    if (clubPlayerKnownIds.length) {
      const [missCpCnt] = await ClubPlayer.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: clubPlayerKnownIds, [Op.ne]: null },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      clubPlayerSoftDeletedMissing = missCpCnt;
    }
  });

  // 4) TeamPlayers
  let teamPlayerUpserts = 0;
  let teamPlayerSoftDeletedMissing = 0;
  let teamPlayerSoftDeletedArchived = 0;
  const teamPlayerActiveIds = teamPlayers.map((tp) => tp.id);
  const teamPlayerArchivedIds = teamPlayersArchived.map((tp) => tp.id);
  const teamPlayerKnownIds = Array.from(
    new Set([...teamPlayerActiveIds, ...teamPlayerArchivedIds])
  );
  const teamPlayerLocals = teamPlayerKnownIds.length
    ? await TeamPlayer.findAll({
        where: { external_id: { [Op.in]: teamPlayerKnownIds } },
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
        season_id: clubPlayerSeasonByExt.get(tp.contract_id) || null,
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
    // Ensure archived membership rows exist as soft-deleted
    const createdArchivedTp = await ensureArchivedImported(
      TeamPlayer,
      teamPlayersArchived,
      (tp) => ({
        team_id: teamIdByExt.get(tp.team_id) || null,
        player_id: playerIdByExt.get(tp.player_id) || null,
        club_player_id: clubPlayerIdByExt.get(tp.contract_id) || null,
        season_id: clubPlayerSeasonByExt.get(tp.contract_id) || null,
      }),
      actorId,
      tx
    );
    teamPlayerUpserts += createdArchivedTp;

    // Soft-delete archived
    const [archTpCnt] = await TeamPlayer.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: {
          external_id: { [Op.in]: teamPlayerArchivedIds },
          deletedAt: null,
        },
        transaction: tx,
        paranoid: false,
      }
    );
    teamPlayerSoftDeletedArchived = archTpCnt;

    // Soft-delete missing
    if (teamPlayerKnownIds.length) {
      const [missTpCnt] = await TeamPlayer.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: teamPlayerKnownIds, [Op.ne]: null },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      teamPlayerSoftDeletedMissing = missTpCnt;
    }
  });

  logger.info(
    'Player sync: players upserted=%d, softDeleted=%d (archived=%d, missing=%d); roles upserted=%d, softDeleted=%d; clubPlayers upserted=%d, softDeleted=%d (archived=%d, missing=%d); teamPlayers upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
    playerUpserts,
    playerSoftDeletedMissing + playerSoftDeletedArchived,
    playerSoftDeletedArchived,
    playerSoftDeletedMissing,
    roleUpserts,
    roleSoftDeleted,
    clubPlayerUpserts,
    clubPlayerSoftDeletedMissing + clubPlayerSoftDeletedArchived,
    clubPlayerSoftDeletedArchived,
    clubPlayerSoftDeletedMissing,
    teamPlayerUpserts,
    teamPlayerSoftDeletedMissing + teamPlayerSoftDeletedArchived,
    teamPlayerSoftDeletedArchived,
    teamPlayerSoftDeletedMissing
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
      softDeletedTotal:
        clubPlayerSoftDeletedMissing + clubPlayerSoftDeletedArchived,
      softDeletedArchived: clubPlayerSoftDeletedArchived,
      softDeletedMissing: clubPlayerSoftDeletedMissing,
    },
    team_players: {
      upserts: teamPlayerUpserts,
      softDeletedTotal:
        teamPlayerSoftDeletedMissing + teamPlayerSoftDeletedArchived,
      softDeletedArchived: teamPlayerSoftDeletedArchived,
      softDeletedMissing: teamPlayerSoftDeletedMissing,
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
  // Filter by clubs (optionally by season via through ClubPlayer)
  if ((options.clubIds && options.clubIds.length) || options.seasonId) {
    const throughWhere = {};
    if (options.seasonId) throughWhere.season_id = options.seasonId;
    include.push({
      model: Club,
      required: true,
      where:
        options.clubIds && options.clubIds.length
          ? { id: { [Op.in]: options.clubIds } }
          : undefined,
      through: Object.keys(throughWhere).length
        ? {
            where: throughWhere,
            attributes: ['number', 'season_id', 'role_id'],
          }
        : { attributes: ['number', 'season_id', 'role_id'] },
    });
  } else if (options.includeClubs) {
    include.push({
      model: Club,
      required: false,
      through: { attributes: ['number', 'season_id', 'role_id'] },
    });
  }
  // Filter by team (optionally by season via through TeamPlayer)
  if (
    options.teamId ||
    options.includeTeams ||
    options.requireTeamWithinClub ||
    options.teamBirthYear ||
    (options.allowedTeamIds && options.allowedTeamIds.length)
  ) {
    const teamInclude = {
      model: Team,
      required: Boolean(
        options.teamId ||
          options.requireTeamWithinClub ||
          options.teamBirthYear ||
          (options.allowedTeamIds && options.allowedTeamIds.length)
      ),
    };
    if (
      options.requireTeamWithinClub &&
      options.clubIds &&
      options.clubIds.length
    ) {
      teamInclude.where = {
        ...(teamInclude.where || {}),
        club_id: { [Op.in]: options.clubIds },
      };
    }
    if (options.teamBirthYear) {
      teamInclude.where = {
        ...(teamInclude.where || {}),
        birth_year: options.teamBirthYear,
      };
    }
    // Scope by allowed teams without overriding explicit team_id filter.
    // If a specific team_id is requested, keep it; otherwise apply allowedTeamIds.
    if (options.allowedTeamIds && options.allowedTeamIds.length) {
      teamInclude.where = {
        ...(teamInclude.where || {}),
        id: { [Op.in]: options.allowedTeamIds },
      };
    }
    // Apply explicit team filter last so it cannot be overridden by scope
    if (options.teamId) {
      teamInclude.where = { ...(teamInclude.where || {}), id: options.teamId };
    }
    if (options.seasonId)
      teamInclude.through = { where: { season_id: options.seasonId } };
    include.push(teamInclude);
  }

  // Filter by birth year
  if (options.birthYear && Number.isFinite(options.birthYear)) {
    const year = options.birthYear;
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    whereClause.date_of_birth = { [Op.between]: [start, end] };
  }

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

async function facets(options = {}) {
  const clubIds = options.clubIds || [];
  const playerWhere = {};
  if (options.search) {
    const term = `%${options.search}%`;
    playerWhere[Op.or] = [
      { surname: { [Op.iLike]: term } },
      { name: { [Op.iLike]: term } },
      { patronymic: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
    ];
  }
  if (options.birthYear && Number.isFinite(options.birthYear)) {
    const year = options.birthYear;
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    playerWhere.date_of_birth = { [Op.between]: [start, end] };
  }

  // Teams facet
  const teams = await Team.findAll({
    attributes: ['id', 'name'],
    where: clubIds.length ? { club_id: { [Op.in]: clubIds } } : undefined,
    include: [
      {
        model: Player,
        required: true,
        where: playerWhere,
        through: options.seasonId
          ? { where: { season_id: options.seasonId } }
          : undefined,
      },
    ],
    order: [['name', 'ASC']],
    subQuery: false,
  }).catch(() => []);

  // Seasons facet
  const seasons = await Season.findAll({
    attributes: ['id', 'name'],
    include: [
      {
        model: TeamPlayer,
        required: true,
        where: options.seasonId ? { season_id: options.seasonId } : undefined,
        include: [
          {
            model: Team,
            required: true,
            where: clubIds.length
              ? {
                  club_id: { [Op.in]: clubIds },
                  ...(options.teamId ? { id: options.teamId } : {}),
                }
              : options.teamId
                ? { id: options.teamId }
                : undefined,
          },
          { model: Player, required: true, where: playerWhere },
        ],
      },
    ],
    order: [['name', 'ASC']],
  }).catch(() => []);

  // Birth years facet
  const birthYearRows = await Player.findAll({
    attributes: [
      [
        sequelize.fn(
          'DATE_PART',
          'year',
          sequelize.col('Player.date_of_birth')
        ),
        'year',
      ],
    ],
    where: playerWhere,
    include: [
      {
        model: Team,
        required: true,
        where: clubIds.length
          ? {
              club_id: { [Op.in]: clubIds },
              ...(options.teamId ? { id: options.teamId } : {}),
            }
          : options.teamId
            ? { id: options.teamId }
            : undefined,
        through: options.seasonId
          ? { where: { season_id: options.seasonId } }
          : undefined,
      },
    ],
    group: [
      sequelize.fn('DATE_PART', 'year', sequelize.col('Player.date_of_birth')),
    ],
    order: [[sequelize.literal('year'), 'DESC']],
    raw: true,
  }).catch(() => []);

  return {
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    seasons: seasons.map((s) => ({ id: s.id, name: s.name })),
    birthYears: birthYearRows
      .map((r) => parseInt(r.year, 10))
      .filter((n) => Number.isFinite(n)),
  };
}

export default { syncExternal, list, listAll, facets };

/**
 * Aggregate player counts by birth year for each season, optionally scoped to specific clubs.
 * Returns an array of objects: [{ season_id, season_name, birth_year, player_count }]
 */
export async function seasonBirthYearCounts(options = {}) {
  const clubIds = options.clubIds?.length ? options.clubIds : null;
  const teamIds = options.teamIds?.length ? options.teamIds : null;
  // Group by team birth_year and season; count distinct players registered (team_players)
  const sql = `
    SELECT c.season_id AS season_id,
           s.name AS season_name,
           s.active AS season_active,
           c.birth_year AS birth_year,
           c.player_count AS player_count
    FROM (
      SELECT tp.season_id AS season_id,
             t.birth_year AS birth_year,
             COUNT(DISTINCT tp.player_id) AS player_count
      FROM team_players tp
      JOIN teams t ON t.id = tp.team_id
      WHERE tp.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND tp.season_id IS NOT NULL
        AND t.birth_year IS NOT NULL
        ${clubIds ? 'AND t.club_id IN (:clubIds)' : ''}
        ${teamIds ? 'AND tp.team_id IN (:teamIds)' : ''}
      GROUP BY tp.season_id, t.birth_year
    ) c
    JOIN seasons s ON s.id = c.season_id
    WHERE s.deleted_at IS NULL
    ORDER BY s.active DESC, s.name DESC, c.birth_year DESC
  `;
  return sequelize.query(sql, {
    replacements: {
      ...(clubIds ? { clubIds } : {}),
      ...(teamIds ? { teamIds } : {}),
    },
    type: QueryTypes.SELECT,
  });
}

/**
 * Per-team summaries for each season within specified clubs/teams.
 * Returns array of rows: [{ season_id, season_name, season_active, team_id, team_name, birth_year, player_count, tournaments: [{ name, group_name }] }]
 */
export async function seasonTeamSummaries(options = {}) {
  const clubIds = options.clubIds?.length ? options.clubIds : null;
  const teamIds = options.teamIds?.length ? options.teamIds : null;

  // Base: player counts by team and season
  const countsSql = `
    SELECT c.season_id AS season_id,
           s.name AS season_name,
           s.active AS season_active,
           c.team_id AS team_id,
           t.name AS team_name,
           t.birth_year AS birth_year,
           c.player_count AS player_count
    FROM (
      SELECT tp.season_id AS season_id,
             tp.team_id AS team_id,
             COUNT(DISTINCT tp.player_id) AS player_count
      FROM team_players tp
      JOIN teams t ON t.id = tp.team_id
      WHERE tp.deleted_at IS NULL
        AND t.deleted_at IS NULL
        ${clubIds ? 'AND t.club_id IN (:clubIds)' : ''}
        ${teamIds ? 'AND tp.team_id IN (:teamIds)' : ''}
      GROUP BY tp.season_id, tp.team_id
    ) c
    JOIN seasons s ON s.id = c.season_id AND s.deleted_at IS NULL
    JOIN teams t ON t.id = c.team_id AND t.deleted_at IS NULL
  `;
  const counts = await sequelize.query(countsSql, {
    replacements: {
      ...(clubIds ? { clubIds } : {}),
      ...(teamIds ? { teamIds } : {}),
    },
    type: QueryTypes.SELECT,
  });

  // Tournaments joined per team and season; include teams even if there are 0 players
  const teamsSet = new Set(counts.map((r) => r.team_id));
  // If teamIds explicitly provided, ensure they're included for tournaments even if no players yet
  if (teamIds) for (const id of teamIds) teamsSet.add(id);
  const allTeamIds = Array.from(teamsSet);

  let tournaments = [];
  if (allTeamIds.length) {
    const tourSql = `
      SELECT tt.team_id AS team_id,
             tor.season_id AS season_id,
             tor.name AS tournament_name,
             tg.name AS group_name,
             ttype.name AS type_name
      FROM tournament_teams tt
      JOIN tournaments tor ON tor.id = tt.tournament_id
      LEFT JOIN tournament_groups tg ON tg.id = tt.tournament_group_id
      LEFT JOIN tournament_types ttype ON ttype.id = tor.type_id
      JOIN teams t ON t.id = tt.team_id
      WHERE tt.deleted_at IS NULL
        AND tor.deleted_at IS NULL
        AND t.deleted_at IS NULL
        ${clubIds ? 'AND t.club_id IN (:clubIds)' : ''}
        AND tt.team_id IN (:allTeamIds)
    `;
    tournaments = await sequelize.query(tourSql, {
      replacements: { allTeamIds, ...(clubIds ? { clubIds } : {}) },
      type: QueryTypes.SELECT,
    });
  }

  // Build index for tournaments by (season_id, team_id)
  const tourByKey = new Map();
  for (const row of tournaments) {
    const key = `${row.season_id}__${row.team_id}`;
    if (!tourByKey.has(key)) tourByKey.set(key, []);
    tourByKey.get(key).push({
      name: row.tournament_name,
      group_name: row.group_name,
      type_name: row.type_name,
    });
  }

  // Merge counts + tournaments; include tournament-only teams with 0 players
  const resultByKey = new Map();
  for (const r of counts) {
    const key = `${r.season_id}__${r.team_id}`;
    resultByKey.set(key, {
      season_id: r.season_id,
      season_name: r.season_name,
      season_active: r.season_active,
      team_id: r.team_id,
      team_name: r.team_name,
      birth_year: r.birth_year,
      player_count: Number(r.player_count) || 0,
      tournaments: tourByKey.get(key) || [],
    });
  }
  for (const [key, list] of tourByKey.entries()) {
    if (!resultByKey.has(key)) {
      const [season_id, team_id] = key.split('__');
      // Resolve season name/active for tournament-only rows via join
      // Rather than a separate query per row, rely on the tournaments array row which contains season_id only.
      // We'll fill season_name/active lazily by querying Seasons in one go.
      resultByKey.set(key, {
        season_id,
        season_name: null,
        season_active: null,
        team_id,
        team_name: null,
        birth_year: null,
        player_count: 0,
        tournaments: list,
      });
    }
  }

  // Fill missing season/team metadata for tournament-only entries
  const missing = Array.from(resultByKey.values()).filter((x) => {
    return !x.season_name || !x.team_name || x.birth_year == null;
  });
  if (missing.length) {
    const seasonIds = Array.from(new Set(missing.map((m) => m.season_id)));
    const teamIdsToLoad = Array.from(new Set(missing.map((m) => m.team_id)));
    const [seasons, teams] = await Promise.all([
      Season.findAll({ where: { id: { [Op.in]: seasonIds } } }),
      Team.findAll({
        where: { id: { [Op.in]: teamIdsToLoad } },
        paranoid: false,
      }),
    ]);
    const seasonById = new Map(seasons.map((s) => [String(s.id), s]));
    const teamById = new Map(teams.map((t) => [String(t.id), t]));
    for (const x of missing) {
      const s = seasonById.get(String(x.season_id));
      const t = teamById.get(String(x.team_id));
      if (s) {
        x.season_name = s.name;
        x.season_active = s.active;
      }
      if (t) {
        x.team_name = t.name;
        x.birth_year = t.birth_year;
      }
    }
  }

  return Array.from(resultByKey.values());
}
