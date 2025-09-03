import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import {
  Match,
  Team,
  User,
  TeamPlayer,
  ClubPlayer,
  Player,
  PlayerRole,
  MatchPlayer,
  Tournament,
  Stage,
  TournamentGroup,
  Tour,
} from '../models/index.js';

function fullName(p) {
  return [p.surname, p.name, p.patronymic].filter(Boolean).join(' ');
}

function isGoalkeeperName(name) {
  if (!name) return false;
  const n = String(name).toLowerCase();
  return (
    n === 'вратарь' || n.includes('goalkeeper') || n === 'gk' || n === 'вр'
  );
}

async function _getActorSides(match, actorUserId) {
  const { default: Role } = await import('../models/role.js');
  const user = await User.findByPk(actorUserId, { include: [Team, Role] });
  const teamIds = new Set((user?.Teams || []).map((t) => t.id));
  const isHome = match.team1_id && teamIds.has(match.team1_id);
  const isAway = match.team2_id && teamIds.has(match.team2_id);
  const roles = new Set(
    (user?.Roles || []).map((r) => (r.alias || r.name || '').toUpperCase())
  );
  const isAdmin = roles.has('ADMIN');
  return { isHome, isAway, isAdmin };
}

async function _listTeamRoster(teamId, seasonId) {
  const include = [
    { model: Player, required: true },
    {
      model: ClubPlayer,
      required: false,
      include: [{ model: PlayerRole, required: false }],
    },
  ];
  const where = { team_id: teamId };
  if (seasonId) where.season_id = seasonId;
  const rows = await TeamPlayer.findAll({
    where,
    include,
    order: [[sequelize.literal('LOWER("Player"."surname")'), 'ASC']],
  });
  return rows.map((tp) => ({
    team_player_id: tp.id,
    player_id: tp.player_id,
    full_name: fullName(tp.Player || {}),
    date_of_birth: tp.Player?.date_of_birth || null,
    number: tp.ClubPlayer?.number || null,
    role: tp.ClubPlayer?.PlayerRole
      ? { id: tp.ClubPlayer.PlayerRole.id, name: tp.ClubPlayer.PlayerRole.name }
      : null,
  }));
}

async function list(matchId, actorUserId) {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'team1_id', 'team2_id', 'season_id'],
    include: [
      { model: Team, as: 'HomeTeam', attributes: ['name'] },
      { model: Team, as: 'AwayTeam', attributes: ['name'] },
      { model: Tournament, attributes: ['name'] },
      { model: Stage, attributes: ['name'] },
      { model: TournamentGroup, attributes: ['name'] },
      { model: Tour, attributes: ['name'] },
    ],
  });
  if (!match) throw Object.assign(new Error('match_not_found'), { code: 404 });
  if (!match.team1_id && !match.team2_id) {
    const err = new Error('match_teams_not_set');
    err.code = 409;
    throw err;
  }
  const { isHome, isAway } = await _getActorSides(match, actorUserId);
  if (!isHome && !isAway) {
    const err = new Error('forbidden_not_match_member');
    err.code = 403;
    throw err;
  }

  const [homeRoster, awayRoster, selectedRows, roles] = await Promise.all([
    match.team1_id ? _listTeamRoster(match.team1_id, match.season_id) : [],
    match.team2_id ? _listTeamRoster(match.team2_id, match.season_id) : [],
    MatchPlayer.findAll({
      attributes: [
        'team_player_id',
        'team_id',
        'number',
        'role_id',
        'is_captain',
        'assistant_order',
      ],
      include: [{ model: PlayerRole, attributes: ['id', 'name'] }],
      where: { match_id: match.id },
    }),
    PlayerRole.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    }),
  ]);
  const selectedByTpId = new Map(
    selectedRows.map((r) => [r.team_player_id, r])
  );

  const markSelected = (arr) =>
    arr.map((p) => {
      const sel = selectedByTpId.get(p.team_player_id);
      return {
        ...p,
        selected: Boolean(sel),
        match_number: sel?.number ?? null,
        match_role: sel?.PlayerRole
          ? { id: sel.PlayerRole.id, name: sel.PlayerRole.name }
          : sel?.role_id
            ? { id: sel.role_id, name: null }
            : null,
        is_gk: isGoalkeeperName(sel?.PlayerRole?.name || p.role?.name || ''),
        is_captain: Boolean(sel?.is_captain),
        assistant_order: sel?.assistant_order ?? null,
      };
    });

  return {
    match_id: match.id,
    team1_id: match.team1_id,
    team2_id: match.team2_id,
    season_id: match.season_id,
    team1_name: match.HomeTeam?.name || null,
    team2_name: match.AwayTeam?.name || null,
    tournament: match.Tournament?.name || null,
    stage: match.Stage?.name || null,
    group: match.TournamentGroup?.name || null,
    tour: match.Tour?.name || null,
    is_home: isHome,
    is_away: isAway,
    home: {
      team_id: match.team1_id,
      players: markSelected(homeRoster),
    },
    away: {
      team_id: match.team2_id,
      players: markSelected(awayRoster),
    },
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
  };
}

async function set(matchId, teamId, playerIdsOrDetailed, actorUserId) {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'team1_id', 'team2_id', 'season_id'],
  });
  if (!match) throw Object.assign(new Error('match_not_found'), { code: 404 });
  if (teamId !== match.team1_id && teamId !== match.team2_id) {
    const err = new Error('team_not_in_match');
    err.code = 400;
    throw err;
  }
  // Check actor permissions (admin check happens at route level; here ensure team membership for staff)
  const { isHome, isAway, isAdmin } = await _getActorSides(match, actorUserId);
  const isTeamActor =
    (teamId === match.team1_id && isHome) ||
    (teamId === match.team2_id && isAway) ||
    isAdmin;
  // If not actor of that team, require ADMIN role at route level. Here just fail.
  if (!isTeamActor) {
    const err = new Error('forbidden_not_team_member');
    err.code = 403;
    throw err;
  }

  let detailed = null;
  let cleanIds = [];
  if (
    Array.isArray(playerIdsOrDetailed) &&
    playerIdsOrDetailed.length &&
    typeof playerIdsOrDetailed[0] === 'object'
  ) {
    detailed = playerIdsOrDetailed.map((p) => ({
      team_player_id: String(p.team_player_id),
      selected: Boolean(p.selected),
      number:
        p.number == null || Number.isNaN(p.number)
          ? null
          : parseInt(p.number, 10),
      role_id: p.role_id ? String(p.role_id) : null,
      is_captain: Boolean(p.is_captain),
      assistant_order:
        p.assistant_order == null || Number.isNaN(p.assistant_order)
          ? null
          : Math.max(1, Math.min(2, parseInt(p.assistant_order, 10))),
    }));
    cleanIds = Array.from(
      new Set(detailed.filter((p) => p.selected).map((p) => p.team_player_id))
    );
  } else {
    const arr = Array.isArray(playerIdsOrDetailed) ? playerIdsOrDetailed : [];
    cleanIds = Array.from(new Set(arr.filter(Boolean)));
  }

  // Validate all provided team_player_ids belong to the target team (and season if set)
  const where = { id: { [Op.in]: cleanIds }, team_id: teamId };
  if (match.season_id) where.season_id = match.season_id;
  const validRows = cleanIds.length
    ? await TeamPlayer.findAll({ attributes: ['id'], where })
    : [];
  const validIds = new Set(validRows.map((r) => r.id));
  for (const id of cleanIds) {
    if (!validIds.has(id)) {
      const err = new Error('player_not_in_team');
      err.code = 400;
      throw err;
    }
  }

  await sequelize.transaction(async (tx) => {
    // Validate GK + field players constraints if detailed provided
    if (Array.isArray(detailed) && detailed.length) {
      const roleIds = Array.from(
        new Set(detailed.map((p) => p.role_id).filter(Boolean))
      );
      const roleRows = roleIds.length
        ? await PlayerRole.findAll({
            attributes: ['id', 'name'],
            where: { id: { [Op.in]: roleIds } },
            transaction: tx,
          })
        : [];
      const roleNameById = new Map(roleRows.map((r) => [String(r.id), r.name]));
      let gkCount = 0;
      let fieldCount = 0;
      let captainCount = 0;
      let assistantCount = 0;
      const numbersSeen = new Set();
      const numbersDup = new Set();
      for (const p of detailed) {
        if (!p.selected) continue;
        const name = roleNameById.get(String(p.role_id)) || '';
        const isGk = isGoalkeeperName(name);
        if (isGk) gkCount += 1;
        else fieldCount += 1;
        if (p.is_captain) captainCount += 1;
        if (p.assistant_order != null) assistantCount += 1;
        if (p.is_captain && isGk) {
          const err = new Error('captain_must_be_field_player');
          err.code = 400;
          throw err;
        }
        if (p.assistant_order != null && isGk) {
          const err = new Error('assistant_must_be_field_player');
          err.code = 400;
          throw err;
        }
        if (p.is_captain && p.assistant_order != null) {
          const err = new Error('captain_cannot_be_assistant');
          err.code = 400;
          throw err;
        }
        if (p.number != null) {
          const key = String(p.number);
          if (numbersSeen.has(key)) numbersDup.add(key);
          else numbersSeen.add(key);
        }
      }
      if (gkCount > 2) {
        const err = new Error('too_many_goalkeepers');
        err.code = 400;
        throw err;
      }
      if (fieldCount > 20) {
        const err = new Error('too_many_field_players');
        err.code = 400;
        throw err;
      }
      if (captainCount > 1) {
        const err = new Error('too_many_captains');
        err.code = 400;
        throw err;
      }
      if (assistantCount > 2) {
        const err = new Error('too_many_assistants');
        err.code = 400;
        throw err;
      }
      if (numbersDup.size > 0) {
        const err = new Error('duplicate_match_numbers');
        err.code = 400;
        throw err;
      }
    }
    // Fetch existing selections for this team/match
    const existing = await MatchPlayer.findAll({
      attributes: ['id', 'team_player_id', 'deletedAt'],
      where: { match_id: match.id, team_id: teamId },
      transaction: tx,
      paranoid: false,
    });
    const existingMap = new Map(existing.map((e) => [e.team_player_id, e]));

    // Add new ones
    for (const tpId of cleanIds) {
      const payload = detailed?.find((p) => p.team_player_id === tpId) || null;
      if (
        payload &&
        payload.selected &&
        (payload.role_id == null || payload.role_id === '')
      ) {
        const err = new Error('match_role_required');
        err.code = 400;
        throw err;
      }
      if (!existingMap.has(tpId)) {
        await MatchPlayer.create(
          {
            match_id: match.id,
            team_id: teamId,
            team_player_id: tpId,
            number: payload ? payload.number : null,
            role_id: payload ? payload.role_id : null,
            is_captain: payload ? Boolean(payload.is_captain) : false,
            assistant_order: payload ? (payload.assistant_order ?? null) : null,
            created_by: actorUserId,
            updated_by: actorUserId,
          },
          { transaction: tx }
        );
      } else {
        const row = existingMap.get(tpId);
        if (row.deletedAt) {
          await row.restore({ transaction: tx });
        }
        // Update overrides if detailed provided
        if (payload) {
          await row.update(
            {
              number: payload.number,
              role_id: payload.role_id,
              is_captain: Boolean(payload.is_captain),
              assistant_order: payload.assistant_order ?? null,
              updated_by: actorUserId,
            },
            { transaction: tx }
          );
        } else {
          await row.update({ updated_by: actorUserId }, { transaction: tx });
        }
      }
    }

    // Soft-delete removed ones (use destroy to ensure proper paranoid handling)
    for (const row of existing) {
      if (!cleanIds.includes(row.team_player_id) && !row.deletedAt) {
        // set updated_by before destroy (optional audit)
        await row.update(
          { updated_by: actorUserId },
          { transaction: tx, paranoid: false }
        );
        await row.destroy({ transaction: tx });
      }
    }
  });

  return { ok: true };
}

export default { list, set };
