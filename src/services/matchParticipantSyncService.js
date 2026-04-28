import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import {
  GamePlayer as ExtGamePlayer,
  GameStaff as ExtGameStaff,
  PlayerPosition as ExtPlayerPosition,
  TeamPlayerRole as ExtTeamPlayerRole,
} from '../externalModels/index.js';
import {
  Match,
  MatchParticipantPlayer,
  MatchParticipantStaff,
  Player,
  PlayerRole,
  Staff,
  Team,
} from '../models/index.js';
import logger from '../../logger.js';

const DEFAULT_BATCH_SIZE = 200;

function toInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBool(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return null;
}

function valueChanged(current, next) {
  return (current ?? null) !== (next ?? null);
}

function buildTeamSide(match, teamId, externalTeamId) {
  const extId = toInt(externalTeamId);
  if (extId != null) {
    if (toInt(match.HomeTeam?.external_id) === extId) return 1;
    if (toInt(match.AwayTeam?.external_id) === extId) return 2;
  }
  if (teamId) {
    if (String(match.team1_id || '') === String(teamId)) return 1;
    if (String(match.team2_id || '') === String(teamId)) return 2;
  }
  return null;
}

async function loadMatches(batchSize) {
  return Match.findAll({
    attributes: ['id', 'external_id', 'team1_id', 'team2_id'],
    where: { external_id: { [Op.ne]: null } },
    include: [
      { model: Team, as: 'HomeTeam', attributes: ['id', 'external_id'] },
      { model: Team, as: 'AwayTeam', attributes: ['id', 'external_id'] },
    ],
    order: [['external_id', 'ASC']],
    limit: batchSize,
  });
}

async function loadAllMatches(batchSize) {
  const rows = [];
  let lastExternalId = 0;
  while (true) {
    const batch = await Match.findAll({
      attributes: ['id', 'external_id', 'team1_id', 'team2_id'],
      where: {
        external_id: {
          [Op.ne]: null,
          [Op.gt]: lastExternalId,
        },
      },
      include: [
        { model: Team, as: 'HomeTeam', attributes: ['id', 'external_id'] },
        { model: Team, as: 'AwayTeam', attributes: ['id', 'external_id'] },
      ],
      order: [['external_id', 'ASC']],
      limit: batchSize,
    });
    if (!batch.length) break;
    rows.push(...batch);
    lastExternalId = Number(batch[batch.length - 1].external_id) || 0;
  }
  return rows;
}

async function mapByExternalId(Model, externalIds, attributes = null) {
  const ids = Array.from(
    new Set(externalIds.map(toInt).filter((id) => id != null))
  );
  if (!ids.length) return new Map();
  const rows = await Model.findAll({
    attributes: attributes || ['id', 'external_id'],
    where: { external_id: { [Op.in]: ids } },
    paranoid: false,
  });
  return new Map(rows.map((row) => [Number(row.external_id), row]));
}

async function mapExternalDictionary(Model, ids, attributes) {
  const cleanIds = Array.from(
    new Set(ids.map(toInt).filter((id) => id != null))
  );
  if (!cleanIds.length) return new Map();
  const rows = await Model.findAll({
    attributes,
    where: { id: { [Op.in]: cleanIds } },
  });
  return new Map(rows.map((row) => [Number(row.id), row]));
}

async function fetchExternalRows(gameIds) {
  const [players, staff] = await Promise.all([
    ExtGamePlayer.findAll({
      where: { game_id: { [Op.in]: gameIds } },
      attributes: [
        'id',
        'game_id',
        'player_id',
        'team_id',
        'number',
        'role_id',
        'position_id',
        'lineup_number',
        'played',
        'played_in_lineup',
      ],
      order: [
        ['game_id', 'ASC'],
        ['team_id', 'ASC'],
        ['number', 'ASC'],
        ['id', 'ASC'],
      ],
    }),
    ExtGameStaff.findAll({
      where: { game_id: { [Op.in]: gameIds } },
      attributes: ['id', 'game_id', 'staff_id', 'team_id', 'position'],
      order: [
        ['game_id', 'ASC'],
        ['team_id', 'ASC'],
        ['id', 'ASC'],
      ],
    }),
  ]);
  return { players, staff };
}

function buildUpdates(local, desired) {
  const updates = {};
  for (const [key, value] of Object.entries(desired)) {
    if (valueChanged(local[key], value)) updates[key] = value;
  }
  return updates;
}

async function reconcilePlayers({
  matches,
  extRows,
  actorId,
  teamByExt,
  playerByExt,
  roleByExt,
  extRoleById,
  extPositionById,
  transaction,
}) {
  const matchByExt = new Map(matches.map((m) => [Number(m.external_id), m]));
  const matchIds = matches.map((m) => m.id);
  const locals = matchIds.length
    ? await MatchParticipantPlayer.findAll({
        where: { match_id: { [Op.in]: matchIds } },
        paranoid: false,
        transaction,
      })
    : [];
  const localByExt = new Map(
    locals.map((row) => [Number(row.external_id), row])
  );
  const activeExternalIds = new Set();
  let upserts = 0;

  for (const row of extRows) {
    const externalId = toInt(row.id);
    const externalGameId = toInt(row.game_id);
    if (externalId == null || externalGameId == null) continue;
    const match = matchByExt.get(externalGameId);
    if (!match) continue;

    activeExternalIds.add(externalId);
    const externalTeamId = toInt(row.team_id);
    const externalPlayerId = toInt(row.player_id);
    const roleExternalId = toInt(row.role_id);
    const positionExternalId = toInt(row.position_id);
    const team = externalTeamId == null ? null : teamByExt.get(externalTeamId);
    const player =
      externalPlayerId == null ? null : playerByExt.get(externalPlayerId);
    const role = roleExternalId == null ? null : roleByExt.get(roleExternalId);
    const extRole =
      roleExternalId == null ? null : extRoleById.get(roleExternalId);
    const extPosition =
      positionExternalId == null
        ? null
        : extPositionById.get(positionExternalId);

    const desired = {
      match_id: match.id,
      team_id: team?.id || null,
      player_id: player?.id || null,
      role_id: role?.id || null,
      external_game_id: externalGameId,
      external_team_id: externalTeamId,
      external_player_id: externalPlayerId,
      role_external_id: roleExternalId,
      role_name: extRole?.name || role?.name || null,
      role_abbreviation: extRole?.abbreviation || null,
      match_position_external_id: positionExternalId,
      match_position_name: extPosition?.name || null,
      match_position_abbreviation: extPosition?.abbreviation || null,
      number: toInt(row.number),
      lineup_number: toInt(row.lineup_number),
      played: toBool(row.played),
      played_in_lineup: toInt(row.played_in_lineup),
      team_side: buildTeamSide(match, team?.id || null, externalTeamId),
    };

    const local = localByExt.get(externalId);
    if (!local) {
      await MatchParticipantPlayer.create(
        {
          external_id: externalId,
          ...desired,
          created_by: actorId,
          updated_by: actorId,
        },
        { transaction }
      );
      upserts += 1;
      continue;
    }
    let changed = false;
    if (local.deletedAt) {
      await local.restore({ transaction });
      changed = true;
    }
    const updates = buildUpdates(local, desired);
    if (Object.keys(updates).length) {
      updates.updated_by = actorId;
      await local.update(updates, { transaction });
      changed = true;
    }
    if (changed) upserts += 1;
  }

  const softDeleteWhere = {
    match_id: { [Op.in]: matchIds },
    deletedAt: null,
  };
  if (activeExternalIds.size) {
    softDeleteWhere.external_id = { [Op.notIn]: Array.from(activeExternalIds) };
  }
  const [softDeleted] = matchIds.length
    ? await MatchParticipantPlayer.update(
        { deletedAt: new Date(), updated_by: actorId },
        { where: softDeleteWhere, paranoid: false, transaction }
      )
    : [0];

  return { upserts, softDeleted };
}

async function reconcileStaff({
  matches,
  extRows,
  actorId,
  teamByExt,
  staffByExt,
  transaction,
}) {
  const matchByExt = new Map(matches.map((m) => [Number(m.external_id), m]));
  const matchIds = matches.map((m) => m.id);
  const locals = matchIds.length
    ? await MatchParticipantStaff.findAll({
        where: { match_id: { [Op.in]: matchIds } },
        paranoid: false,
        transaction,
      })
    : [];
  const localByExt = new Map(
    locals.map((row) => [Number(row.external_id), row])
  );
  const activeExternalIds = new Set();
  let upserts = 0;

  for (const row of extRows) {
    const externalId = toInt(row.id);
    const externalGameId = toInt(row.game_id);
    if (externalId == null || externalGameId == null) continue;
    const match = matchByExt.get(externalGameId);
    if (!match) continue;

    activeExternalIds.add(externalId);
    const externalTeamId = toInt(row.team_id);
    const externalStaffId = toInt(row.staff_id);
    const team = externalTeamId == null ? null : teamByExt.get(externalTeamId);
    const staff =
      externalStaffId == null ? null : staffByExt.get(externalStaffId);

    const desired = {
      match_id: match.id,
      team_id: team?.id || null,
      staff_id: staff?.id || null,
      external_game_id: externalGameId,
      external_team_id: externalTeamId,
      external_staff_id: externalStaffId,
      position: row.position || null,
      team_side: buildTeamSide(match, team?.id || null, externalTeamId),
    };

    const local = localByExt.get(externalId);
    if (!local) {
      await MatchParticipantStaff.create(
        {
          external_id: externalId,
          ...desired,
          created_by: actorId,
          updated_by: actorId,
        },
        { transaction }
      );
      upserts += 1;
      continue;
    }
    let changed = false;
    if (local.deletedAt) {
      await local.restore({ transaction });
      changed = true;
    }
    const updates = buildUpdates(local, desired);
    if (Object.keys(updates).length) {
      updates.updated_by = actorId;
      await local.update(updates, { transaction });
      changed = true;
    }
    if (changed) upserts += 1;
  }

  const softDeleteWhere = {
    match_id: { [Op.in]: matchIds },
    deletedAt: null,
  };
  if (activeExternalIds.size) {
    softDeleteWhere.external_id = { [Op.notIn]: Array.from(activeExternalIds) };
  }
  const [softDeleted] = matchIds.length
    ? await MatchParticipantStaff.update(
        { deletedAt: new Date(), updated_by: actorId },
        { where: softDeleteWhere, paranoid: false, transaction }
      )
    : [0];

  return { upserts, softDeleted };
}

export async function syncExternal(options = {}) {
  const actorId = options.actorId ?? options.userId ?? null;
  const batchSize = Math.max(
    1,
    Number.parseInt(String(options.batchSize || DEFAULT_BATCH_SIZE), 10)
  );
  const matches = await loadAllMatches(batchSize);
  const stats = {
    matches: matches.length,
    players: { upserts: 0, softDeleted: 0 },
    staff: { upserts: 0, softDeleted: 0 },
    fullSync: true,
  };
  if (!matches.length) return stats;

  for (let index = 0; index < matches.length; index += batchSize) {
    const batch = matches.slice(index, index + batchSize);
    const gameIds = batch
      .map((match) => toInt(match.external_id))
      .filter((id) => id != null);
    if (!gameIds.length) continue;

    const { players: extPlayers, staff: extStaff } =
      await fetchExternalRows(gameIds);
    const teamExtIds = [
      ...extPlayers.map((row) => row.team_id),
      ...extStaff.map((row) => row.team_id),
      ...batch.map((match) => match.HomeTeam?.external_id),
      ...batch.map((match) => match.AwayTeam?.external_id),
    ];

    const [
      teamByExt,
      playerByExt,
      staffByExt,
      roleByExt,
      extRoleById,
      extPositionById,
    ] = await Promise.all([
      mapByExternalId(Team, teamExtIds),
      mapByExternalId(
        Player,
        extPlayers.map((row) => row.player_id)
      ),
      mapByExternalId(
        Staff,
        extStaff.map((row) => row.staff_id)
      ),
      mapByExternalId(
        PlayerRole,
        extPlayers.map((row) => row.role_id),
        ['id', 'external_id', 'name']
      ),
      mapExternalDictionary(
        ExtTeamPlayerRole,
        extPlayers.map((row) => row.role_id),
        ['id', 'name', 'abbreviation']
      ),
      mapExternalDictionary(
        ExtPlayerPosition,
        extPlayers.map((row) => row.position_id),
        ['id', 'name', 'abbreviation']
      ),
    ]);

    const batchStats = await sequelize.transaction(async (transaction) => {
      const playerStats = await reconcilePlayers({
        matches: batch,
        extRows: extPlayers,
        actorId,
        teamByExt,
        playerByExt,
        roleByExt,
        extRoleById,
        extPositionById,
        transaction,
      });
      const staffStats = await reconcileStaff({
        matches: batch,
        extRows: extStaff,
        actorId,
        teamByExt,
        staffByExt,
        transaction,
      });
      return { playerStats, staffStats };
    });

    stats.players.upserts += batchStats.playerStats.upserts;
    stats.players.softDeleted += batchStats.playerStats.softDeleted;
    stats.staff.upserts += batchStats.staffStats.upserts;
    stats.staff.softDeleted += batchStats.staffStats.softDeleted;
  }

  logger.info(
    'Match participant sync: matches=%d players(upserted=%d, softDeleted=%d) staff(upserted=%d, softDeleted=%d)',
    stats.matches,
    stats.players.upserts,
    stats.players.softDeleted,
    stats.staff.upserts,
    stats.staff.softDeleted
  );
  return stats;
}

export default { syncExternal };

export const _private = {
  buildTeamSide,
  toBool,
  toInt,
  loadMatches,
};
