import sequelize from '../config/database.js';
import {
  Player,
  TeamPlayer,
  ClubPlayer,
  PlayerRole,
  Season,
  Team,
  Club,
} from '../models/index.js';
import logger from '../../logger.js';
import {
  updateExternalPlayerAnthropometry,
  updateExternalClubPlayerNumberAndRole,
} from '../config/externalMariaDb.js';

function sanitizeIntOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s.slice(0, 255) : null;
}

export async function updateAnthropometryAndRoster({
  actor,
  playerId,
  seasonId,
  teamId,
  clubId,
  grip,
  height,
  weight,
  jerseyNumber,
  roleId,
}) {
  // Basic payload validation
  if (!playerId) throw new Error('player_id_required');
  if (!seasonId) throw new Error('season_id_required');
  if (!teamId) throw new Error('team_id_required');
  if (!clubId) throw new Error('club_id_required');

  const allowedGrips = new Set(['Правый', 'Левый']);
  const desired = {
    grip: trimOrNull(grip),
    height: sanitizeIntOrNull(height),
    weight: sanitizeIntOrNull(weight),
    number: sanitizeIntOrNull(jerseyNumber),
    roleId: roleId || null,
  };
  // Field requirements and ranges (corporate standard)
  if (!desired.grip) throw new Error('grip_required');
  if (!allowedGrips.has(desired.grip)) throw new Error('invalid_grip');
  if (desired.height != null && (desired.height < 90 || desired.height > 220))
    throw new Error('invalid_height');
  if (desired.weight != null && (desired.weight < 10 || desired.weight > 140))
    throw new Error('invalid_weight');
  if (desired.number == null) throw new Error('jersey_required');
  if (desired.number < 1 || desired.number > 99)
    throw new Error('jersey_invalid');

  // Load entities and validate relations
  const [player, team, club, season] = await Promise.all([
    Player.findByPk(playerId),
    Team.findByPk(teamId),
    Club.findByPk(clubId),
    Season.findByPk(seasonId),
  ]);
  if (!player)
    throw Object.assign(new Error('player_not_found'), { code: 404 });
  if (!team) throw Object.assign(new Error('team_not_found'), { code: 404 });
  if (!club) throw Object.assign(new Error('club_not_found'), { code: 404 });
  if (!season)
    throw Object.assign(new Error('season_not_found'), { code: 404 });
  if (String(team.club_id) !== String(club.id))
    throw Object.assign(new Error('team_not_in_club'), { code: 400 });

  // Ensure team membership this season
  const teamPlayer = await TeamPlayer.findOne({
    where: { player_id: player.id, team_id: team.id, season_id: season.id },
    include: [{ model: ClubPlayer }],
  });
  if (!teamPlayer)
    throw Object.assign(new Error('team_player_not_found'), { code: 400 });
  const clubPlayer = teamPlayer.ClubPlayer
    ? teamPlayer.ClubPlayer
    : await ClubPlayer.findOne({
        where: { player_id: player.id, club_id: club.id, season_id: season.id },
      });
  if (!clubPlayer)
    throw Object.assign(new Error('club_player_not_found'), { code: 400 });

  if (!desired.roleId) throw new Error('role_required');
  const role = await PlayerRole.findByPk(desired.roleId);
  if (!role) throw Object.assign(new Error('role_not_found'), { code: 400 });

  // Prepare updates
  const playerUpdates = {
    grip: desired.grip,
    height: desired.height,
    weight: desired.weight,
    updated_by: actor?.id || null,
  };
  const clubPlayerUpdates = {
    number: desired.number,
    role_id: role ? role.id : null,
    updated_by: actor?.id || null,
  };

  // Local transaction; commit only after external writes succeed
  return sequelize.transaction(async (tx) => {
    await player.update(playerUpdates, { transaction: tx });
    await clubPlayer.update(clubPlayerUpdates, { transaction: tx });

    // External writes (awaited). If any throws, transaction is rolled back
    try {
      await updateExternalPlayerAnthropometry({
        playerId: player.external_id,
        grip: desired.grip,
        height: desired.height,
        weight: desired.weight,
      });
      await updateExternalClubPlayerNumberAndRole({
        clubPlayerId: clubPlayer.external_id,
        number: desired.number,
        roleExternalId: role ? role.external_id : null,
      });
    } catch (err) {
      // Log context for observability; rollback will be automatic
      logger.warn(
        'External write failed for player %s, club_player %s: %s',
        player.external_id,
        clubPlayer.external_id,
        err.message
      );
      // Re-throw to abort transaction
      throw err;
    }

    // Return merged public subset for UI optimistic update
    return {
      id: player.id,
      height: desired.height,
      weight: desired.weight,
      grip: desired.grip,
      jersey_number: desired.number,
      role: role ? { id: role.id, name: role.name } : null,
    };
  });
}

export default { updateAnthropometryAndRoster };
