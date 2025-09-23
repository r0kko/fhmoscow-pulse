import crypto from 'node:crypto';

import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import {
  Match,
  Team,
  TeamPlayer,
  ClubPlayer,
  Player,
  PlayerRole,
  MatchPlayer,
  Tournament,
  TournamentType,
  Stage,
  TournamentGroup,
  Tour,
} from '../models/index.js';
import {
  resolveMatchAccessContext,
  evaluateStaffMatchRestrictions,
  buildPermissionPayload,
} from '../utils/matchAccess.js';

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

async function loadActorContext(match, actorUserId) {
  const context = await resolveMatchAccessContext({
    matchOrId: match,
    userId: actorUserId,
  });
  const restrictions = evaluateStaffMatchRestrictions(context);
  const isAdmin = context.isAdmin || false;
  if (!context.isHome && !context.isAway && !isAdmin) {
    const err = new Error('forbidden_not_match_member');
    err.code = 403;
    throw err;
  }
  return { context, restrictions, isAdmin };
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
    attributes: ['id', 'team1_id', 'team2_id', 'season_id', 'tournament_id'],
    include: [
      { model: Team, as: 'HomeTeam', attributes: ['name'] },
      { model: Team, as: 'AwayTeam', attributes: ['name'] },
      {
        model: Tournament,
        attributes: ['name', 'type_id'],
        include: [{ model: TournamentType, attributes: ['double_protocol'] }],
      },
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
  const { context, restrictions, isAdmin } = await loadActorContext(
    match,
    actorUserId
  );
  const { isHome, isAway } = context;
  if (restrictions.lineupsBlocked) {
    const err = new Error('staff_position_restricted');
    err.code = 403;
    throw err;
  }
  const permissions = buildPermissionPayload(restrictions, context);

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
        'squad_no',
        'squad_both',
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

  // Compute team revisions (optimistic concurrency tokens)
  function computeTeamRev(teamId) {
    const rows = selectedRows
      .filter((r) => String(r.team_id) === String(teamId))
      .map((r) => ({
        id: String(r.team_player_id),
        n: r.number ?? null,
        role: r.role_id ? String(r.role_id) : null,
        c: Boolean(r.is_captain),
        a: r.assistant_order == null ? null : Number(r.assistant_order),
        s: r.squad_no == null ? null : Number(r.squad_no),
        b: Boolean(r.squad_both),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const json = JSON.stringify(rows);
    return crypto.createHash('sha1').update(json).digest('hex');
  }
  const homeRev = match.team1_id ? computeTeamRev(match.team1_id) : null;
  const awayRev = match.team2_id ? computeTeamRev(match.team2_id) : null;

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
        squad_no: sel?.squad_no ?? null,
        squad_both: Boolean(sel?.squad_both ?? false),
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
    double_protocol: !!match.Tournament?.TournamentType?.double_protocol,
    stage: match.Stage?.name || null,
    group: match.TournamentGroup?.name || null,
    tour: match.Tour?.name || null,
    is_home: isHome,
    is_away: isAway,
    is_admin: isAdmin,
    permissions,
    home_rev: homeRev,
    away_rev: awayRev,
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

async function set(
  matchId,
  teamId,
  playerIdsOrDetailed,
  actorUserId,
  ifMatchRev
) {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'team1_id', 'team2_id', 'season_id', 'tournament_id'],
    include: [
      {
        model: Tournament,
        attributes: ['id', 'type_id'],
        include: [{ model: TournamentType, attributes: ['double_protocol'] }],
      },
    ],
  });
  if (!match) throw Object.assign(new Error('match_not_found'), { code: 404 });
  if (teamId !== match.team1_id && teamId !== match.team2_id) {
    const err = new Error('team_not_in_match');
    err.code = 400;
    throw err;
  }
  // Check actor permissions (admin check happens at route level; here ensure team membership for staff)
  const { context, restrictions, isAdmin } = await loadActorContext(
    match,
    actorUserId
  );
  const { isHome, isAway } = context;
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
  if (restrictions.lineupsBlocked) {
    const err = new Error('staff_position_restricted');
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
      squad_no:
        p.squad_no == null || Number.isNaN(p.squad_no)
          ? null
          : Math.max(1, Math.min(2, parseInt(p.squad_no, 10))),
      squad_both: Boolean(p.squad_both),
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
    // Check optimistic concurrency token if provided
    if (ifMatchRev) {
      const existingRows = await MatchPlayer.findAll({
        attributes: [
          'team_player_id',
          'team_id',
          'number',
          'role_id',
          'is_captain',
          'assistant_order',
          'squad_no',
          'squad_both',
        ],
        where: { match_id: match.id, team_id: teamId },
        transaction: tx,
      });
      const rows = existingRows
        .map((r) => ({
          id: String(r.team_player_id),
          n: r.number ?? null,
          role: r.role_id ? String(r.role_id) : null,
          c: Boolean(r.is_captain),
          a: r.assistant_order == null ? null : Number(r.assistant_order),
          s: r.squad_no == null ? null : Number(r.squad_no),
          b: Boolean(r.squad_both),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      const json = JSON.stringify(rows);
      const currentRev = crypto.createHash('sha1').update(json).digest('hex');
      if (String(currentRev) !== String(ifMatchRev)) {
        const err = new Error('conflict_lineup_version');
        err.code = 409;
        throw err;
      }
    }
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
      const isDouble = !!match.Tournament?.TournamentType?.double_protocol;
      // Per-squad accumulators for double protocol; otherwise single bucket
      const gkCountBy = new Map(); // squad -> count
      const fieldCountBy = new Map();
      const captainCountBy = new Map();
      const assistantCountBy = new Map();
      const numbersSeenBy = new Map(); // squad -> Set(numbers)
      const numbersDup = new Set(); // global dup flag, per-squad logic applied
      let gkBothCount = 0;
      let selectedGkTotal = 0;
      for (const p of detailed) {
        if (!p.selected) continue;
        const squadKey = isDouble ? p.squad_no || null : 'all';
        const name = roleNameById.get(String(p.role_id)) || '';
        const isGk = isGoalkeeperName(name);
        if (isGk) {
          selectedGkTotal += 1;
          if (isDouble && p.squad_both) {
            gkBothCount += 1;
            // counts for both squads
            gkCountBy.set(1, (gkCountBy.get(1) || 0) + 1);
            gkCountBy.set(2, (gkCountBy.get(2) || 0) + 1);
          } else {
            gkCountBy.set(squadKey, (gkCountBy.get(squadKey) || 0) + 1);
          }
        } else
          fieldCountBy.set(squadKey, (fieldCountBy.get(squadKey) || 0) + 1);
        if (p.is_captain)
          captainCountBy.set(squadKey, (captainCountBy.get(squadKey) || 0) + 1);
        if (p.assistant_order != null)
          assistantCountBy.set(
            squadKey,
            (assistantCountBy.get(squadKey) || 0) + 1
          );
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
          if (isDouble && isGk && p.squad_both) {
            for (const sk of [1, 2]) {
              const bucket = numbersSeenBy.get(sk) || new Set();
              if (bucket.has(key)) numbersDup.add(`${sk}:${key}`);
              bucket.add(key);
              numbersSeenBy.set(sk, bucket);
            }
          } else {
            const bucket = numbersSeenBy.get(squadKey) || new Set();
            if (bucket.has(key)) numbersDup.add(`${squadKey || 'none'}:${key}`);
            bucket.add(key);
            numbersSeenBy.set(squadKey, bucket);
          }
        }
      }
      if (isDouble && gkBothCount > 1) {
        const err = new Error('too_many_goalkeepers_both');
        err.code = 400;
        throw err;
      }
      if (isDouble && gkBothCount === 1 && selectedGkTotal !== 3) {
        const err = new Error('gk_both_requires_three');
        err.code = 400;
        throw err;
      }
      // For single protocol, keep global limits; for double, do not enforce here
      if (!isDouble) {
        const gkCount = gkCountBy.get('all') || 0;
        const fieldCount = fieldCountBy.get('all') || 0;
        const captainCount = captainCountBy.get('all') || 0;
        const assistantCount = assistantCountBy.get('all') || 0;
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
      } else {
        // For double: enforce per-squad leadership upper bounds and cap players per squad
        for (const [, cap] of captainCountBy.entries()) {
          if (cap > 1) {
            const err = new Error('too_many_captains');
            err.code = 400;
            throw err;
          }
        }
        for (const [, asst] of assistantCountBy.entries()) {
          if (asst > 2) {
            const err = new Error('too_many_assistants');
            err.code = 400;
            throw err;
          }
        }
        // Enforce total players per squad <= 15
        const totalBy = new Map(); // squad -> total
        for (const p of detailed) {
          if (!p.selected) continue;
          const sq =
            p.squad_no == null || Number.isNaN(p.squad_no) ? null : p.squad_no;
          const name = roleNameById.get(String(p.role_id)) || '';
          const isGk = isGoalkeeperName(name);
          if (isGk && p.squad_both) {
            totalBy.set(1, (totalBy.get(1) || 0) + 1);
            totalBy.set(2, (totalBy.get(2) || 0) + 1);
          } else if (sq === 1 || sq === 2) {
            totalBy.set(sq, (totalBy.get(sq) || 0) + 1);
          }
        }
        for (const [, total] of totalBy.entries()) {
          if (total > 15) {
            const err = new Error('too_many_players_in_squad');
            err.code = 400;
            throw err;
          }
        }
      }
      // Progressive save: allow duplicate numbers during editing; UI/export gate uniqueness
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
      // Progressive save: do not require role_id at this point
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
            squad_no: payload ? (payload.squad_no ?? null) : null,
            squad_both: payload ? Boolean(payload.squad_both) : false,
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
              squad_no: payload.squad_no ?? null,
              squad_both: Boolean(payload.squad_both),
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
  // Return updated team revision
  const newRows = await MatchPlayer.findAll({
    attributes: [
      'team_player_id',
      'team_id',
      'number',
      'role_id',
      'is_captain',
      'assistant_order',
      'squad_no',
      'squad_both',
    ],
    where: { match_id: matchId, team_id: teamId },
  });
  const rows = newRows
    .map((r) => ({
      id: String(r.team_player_id),
      n: r.number ?? null,
      role: r.role_id ? String(r.role_id) : null,
      c: Boolean(r.is_captain),
      a: r.assistant_order == null ? null : Number(r.assistant_order),
      s: r.squad_no == null ? null : Number(r.squad_no),
      b: Boolean(r.squad_both),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const team_rev = crypto
    .createHash('sha1')
    .update(JSON.stringify(rows))
    .digest('hex');
  return { ok: true, team_rev };
}

export default { list, set };
