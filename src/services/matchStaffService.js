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
    attributes: ['id', 'team1_id', 'team2_id', 'season_id'],
  });
  if (!match) throw Object.assign(new Error('match_not_found'), { code: 404 });
  const { isHome, isAway } = await getActorSides(match, actorUserId);
  if (!isHome && !isAway) {
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
      attributes: ['team_staff_id', 'team_id', 'role_id'],
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
  return {
    match_id: match.id,
    team1_id: match.team1_id,
    team2_id: match.team2_id,
    season_id: match.season_id,
    home: { team_id: match.team1_id, staff: homeStaff.map(mapRow) },
    away: { team_id: match.team2_id, staff: awayStaff.map(mapRow) },
    categories: (categories || []).map((c) => ({ id: c.id, name: c.name })),
  };
}

async function set(matchId, teamId, teamStaffIds, staffDetailed, actorUserId) {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'team1_id', 'team2_id', 'season_id'],
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
        if (nm === 'главный тренер') headCount += 1;
      }
    }
    if (headCount > 1) {
      const err = new Error('too_many_head_coaches');
      err.code = 400;
      throw err;
    }
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
    const byId = new Map(existing.map((e) => [e.team_staff_id, e]));
    for (const tsId of ids) {
      if (!byId.has(tsId)) {
        await MatchStaff.create(
          {
            match_id: match.id,
            team_id: teamId,
            team_staff_id: tsId,
            role_id: roleByTsId.get(String(tsId)) || null,
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
  return { ok: true };
}

export default { list, set };
