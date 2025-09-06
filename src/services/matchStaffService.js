import crypto from 'node:crypto';

import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import {
  Match,
  Team,
  User,
  TeamStaff,
  Staff,
  ClubStaff,
  StaffCategory,
  MatchStaff,
} from '../models/index.js';

async function getActorSides(match, actorUserId) {
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

function fio(s) {
  return [s.surname, s.name, s.patronymic].filter(Boolean).join(' ');
}

async function list(matchId, actorUserId) {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'team1_id', 'team2_id', 'season_id', 'tournament_id'],
    include: [
      {
        model: (await import('../models/index.js')).Tournament,
        attributes: ['type_id'],
        include: [
          {
            model: (await import('../models/index.js')).TournamentType,
            attributes: ['double_protocol'],
          },
        ],
      },
    ],
  });
  if (!match) throw Object.assign(new Error('match_not_found'), { code: 404 });
  const { isHome, isAway, isAdmin } = await getActorSides(match, actorUserId);
  if (!isHome && !isAway && !isAdmin) {
    const err = new Error('forbidden_not_match_member');
    err.code = 403;
    throw err;
  }
  const where1 = { team_id: match.team1_id };
  const where2 = { team_id: match.team2_id };
  if (match.season_id) {
    where1.season_id = match.season_id;
    where2.season_id = match.season_id;
  }
  const [homeStaff, awayStaff, selected, categories] = await Promise.all([
    match.team1_id
      ? TeamStaff.findAll({
          where: where1,
          include: [
            { model: Staff },
            { model: ClubStaff, include: [StaffCategory] },
          ],
          order: [
            [Staff, 'surname', 'ASC'],
            [Staff, 'name', 'ASC'],
          ],
        })
      : [],
    match.team2_id
      ? TeamStaff.findAll({
          where: where2,
          include: [
            { model: Staff },
            { model: ClubStaff, include: [StaffCategory] },
          ],
          order: [
            [Staff, 'surname', 'ASC'],
            [Staff, 'name', 'ASC'],
          ],
        })
      : [],
    MatchStaff.findAll({
      attributes: ['team_staff_id', 'team_id', 'role_id', 'squad_no'],
      where: { match_id: match.id },
    }),
    StaffCategory.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    }),
  ]);
  const sel = new Set(selected.map((r) => r.team_staff_id));
  const selById = new Map(selected.map((r) => [r.team_staff_id, r]));
  const catNameById = new Map(
    (categories || []).map((c) => [String(c.id), c.name])
  );
  const isHeadCoachName = (nm) => (nm || '').toLowerCase() === 'главный тренер';
  const mapRow = (ts) => ({
    team_staff_id: ts.id,
    staff_id: ts.staff_id,
    full_name: fio(ts.Staff || {}),
    date_of_birth: ts.Staff?.date_of_birth || null,
    role: ts.ClubStaff?.StaffCategory
      ? {
          id: ts.ClubStaff.StaffCategory.id,
          name: ts.ClubStaff.StaffCategory.name,
        }
      : null,
    match_role: (function () {
      const r = selById.get(ts.id);
      const rid = r?.role_id ? String(r.role_id) : null;
      return rid ? { id: rid, name: catNameById.get(rid) || null } : null;
    })(),
    squad_no: (function () {
      const r = selById.get(ts.id);
      return r?.squad_no ?? null;
    })(),
    selected: sel.has(ts.id),
    is_head_coach: (function () {
      // Consider head coach ONLY by match role override (no base fallback)
      const rid = selById.get(ts.id)?.role_id
        ? String(selById.get(ts.id).role_id)
        : null;
      const nm = rid ? catNameById.get(rid) || '' : '';
      return sel.has(ts.id) && isHeadCoachName(nm);
    })(),
  });
  // Compute team revisions (optimistic concurrency tokens)
  function computeTeamRev(teamId) {
    const rows = selected
      .filter((r) => String(r.team_id) === String(teamId))
      .map((r) => ({
        id: String(r.team_staff_id),
        role: r.role_id ? String(r.role_id) : null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const json = JSON.stringify(rows);
    return crypto.createHash('sha1').update(json).digest('hex');
  }
  const homeRev = match.team1_id ? computeTeamRev(match.team1_id) : null;
  const awayRev = match.team2_id ? computeTeamRev(match.team2_id) : null;
  return {
    match_id: match.id,
    team1_id: match.team1_id,
    team2_id: match.team2_id,
    season_id: match.season_id,
    is_admin: isAdmin,
    home: { team_id: match.team1_id, staff: homeStaff.map(mapRow) },
    away: { team_id: match.team2_id, staff: awayStaff.map(mapRow) },
    categories: (categories || []).map((c) => ({ id: c.id, name: c.name })),
    home_rev: homeRev,
    away_rev: awayRev,
  };
}

async function set(
  matchId,
  teamId,
  teamStaffIds,
  staffDetailed,
  actorUserId,
  ifStaffRev
) {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'team1_id', 'team2_id', 'season_id', 'tournament_id'],
    include: [
      {
        model: (await import('../models/index.js')).Tournament,
        attributes: ['type_id'],
        include: [
          {
            model: (await import('../models/index.js')).TournamentType,
            attributes: ['double_protocol'],
          },
        ],
      },
    ],
  });
  if (!match) throw Object.assign(new Error('match_not_found'), { code: 404 });
  if (teamId !== match.team1_id && teamId !== match.team2_id) {
    const err = new Error('team_not_in_match');
    err.code = 400;
    throw err;
  }
  const { isHome, isAway, isAdmin } = await getActorSides(match, actorUserId);
  if (
    !(
      (teamId === match.team1_id && isHome) ||
      (teamId === match.team2_id && isAway) ||
      isAdmin
    )
  ) {
    const err = new Error('forbidden_not_team_member');
    err.code = 403;
    throw err;
  }
  let ids = [];
  const roleByTsId = new Map();
  if (Array.isArray(staffDetailed) && staffDetailed.length) {
    // Only selected staff are considered for match selection (mirror players flow)
    ids = Array.from(
      new Set(
        staffDetailed
          .filter((x) => x && x.team_staff_id && x.selected)
          .map((x) => x.team_staff_id)
      )
    );
    for (const it of staffDetailed) {
      if (!it || !it.team_staff_id) continue;
      const rid = it.role_id ? String(it.role_id) : null;
      roleByTsId.set(String(it.team_staff_id), rid);
      // squad_no deprecated — ignore
    }
  } else {
    ids = Array.isArray(teamStaffIds)
      ? Array.from(new Set(teamStaffIds.filter(Boolean)))
      : [];
  }

  if (ids.length > 8) {
    const err = new Error('too_many_officials');
    err.code = 400;
    throw err;
  }
  const where = { id: { [Op.in]: ids }, team_id: teamId };
  if (match.season_id) where.season_id = match.season_id;
  const valid = ids.length
    ? await TeamStaff.findAll({ attributes: ['id'], where })
    : [];
  const validIds = new Set(valid.map((v) => v.id));
  // build role overrides map
  if (Array.isArray(staffDetailed) && staffDetailed.length) {
    const catRows = await StaffCategory.findAll({ attributes: ['id', 'name'] });
    const nameById = new Map(
      catRows.map((c) => [String(c.id), c.name.toLowerCase()])
    );
    let headCount = 0;
    for (const it of staffDetailed) {
      if (!it || !it.team_staff_id) continue;
      if (it.selected) {
        const rid = it.role_id ? String(it.role_id) : null;
        roleByTsId.set(String(it.team_staff_id), rid);
        const nm = rid ? nameById.get(rid) || '' : '';
        if (nm === 'главный тренер') {
          headCount += 1;
          // per-squad head coach counts deprecated
        }
        // no per-squad coach limits anymore
      }
    }
    // Global rule: only one head coach per team regardless of protocol format
    if (headCount > 1) {
      const err = new Error('too_many_head_coaches');
      err.code = 400;
      throw err;
    }
    // no per-squad coach limits — staff list is global for export
  }
  for (const id of ids) {
    if (!validIds.has(id)) {
      const err = new Error('staff_not_in_team');
      err.code = 400;
      throw err;
    }
  }
  await sequelize.transaction(async (tx) => {
    const existing = await MatchStaff.findAll({
      attributes: ['id', 'team_staff_id', 'team_id', 'role_id', 'deletedAt'],
      where: { match_id: match.id, team_id: teamId },
      transaction: tx,
      paranoid: false,
    });
    if (ifStaffRev) {
      const rows = existing
        .map((r) => ({
          id: String(r.team_staff_id),
          role: r.role_id ? String(r.role_id) : null,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      const json = JSON.stringify(rows);
      const currentRev = crypto.createHash('sha1').update(json).digest('hex');
      if (String(currentRev) !== String(ifStaffRev)) {
        const err = new Error('conflict_staff_version');
        err.code = 409;
        throw err;
      }
    }
    const byId = new Map(existing.map((e) => [e.team_staff_id, e]));
    for (const tsId of ids) {
      if (!byId.has(tsId)) {
        await MatchStaff.create(
          {
            match_id: match.id,
            team_id: teamId,
            team_staff_id: tsId,
            role_id: roleByTsId.get(String(tsId)) || null,
            squad_no: null,
            created_by: actorUserId,
            updated_by: actorUserId,
          },
          { transaction: tx }
        );
      } else {
        const row = byId.get(tsId);
        if (row.deletedAt) await row.restore({ transaction: tx });
        await row.update(
          {
            role_id: roleByTsId.get(String(tsId)) || null,
            squad_no: null,
            updated_by: actorUserId,
          },
          { transaction: tx }
        );
      }
    }
    for (const row of existing) {
      if (!ids.includes(row.team_staff_id) && !row.deletedAt) {
        await row.update(
          { updated_by: actorUserId },
          { transaction: tx, paranoid: false }
        );
        await row.destroy({ transaction: tx });
      }
    }
  });
  // Return updated team revision
  const after = await MatchStaff.findAll({
    attributes: ['team_staff_id', 'team_id', 'role_id'],
    where: { match_id: match.id, team_id: teamId },
  });
  const rows = after
    .map((r) => ({
      id: String(r.team_staff_id),
      role: r.role_id ? String(r.role_id) : null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const team_rev = crypto
    .createHash('sha1')
    .update(JSON.stringify(rows))
    .digest('hex');
  return { ok: true, team_rev };
}

export default { list, set };
