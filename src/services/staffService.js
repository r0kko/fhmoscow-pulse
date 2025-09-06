import { Op } from 'sequelize';

import {
  Club,
  ClubStaff,
  Season,
  Staff,
  StaffCategory,
  Team,
  TeamStaff,
} from '../models/index.js';
import {
  ClubStaff as ExtClubStaff,
  Staff as ExtStaff,
  StaffCategory as ExtStaffCategory,
  TeamStaff as ExtTeamStaff,
} from '../externalModels/index.js';
import sequelize from '../config/database.js';
import logger from '../../logger.js';
import { ensureArchivedImported, statusFilters } from '../utils/sync.js';

async function syncExternal(actorId = null) {
  // 1) Staff categories
  const extCategories = await ExtStaffCategory.findAll();
  const catExtIds = extCategories.map((x) => x.id);
  let categoryUpserts = 0;
  let categorySoftDeleted = 0;
  await sequelize.transaction(async (tx) => {
    const locals = catExtIds.length
      ? await StaffCategory.findAll({
          where: { external_id: { [Op.in]: catExtIds } },
          paranoid: false,
          transaction: tx,
        })
      : [];
    const localByExt = new Map(locals.map((l) => [l.external_id, l]));
    for (const c of extCategories) {
      const local = localByExt.get(c.id);
      const desired = { name: c.name || null };
      if (!local) {
        await StaffCategory.create(
          {
            external_id: c.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        categoryUpserts += 1;
        continue;
      }
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        categoryUpserts += 1;
      }
      const updates = {};
      if (local.name !== desired.name) updates.name = desired.name;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        categoryUpserts += 1;
      }
    }
    const [softCnt] = await StaffCategory.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: {
          external_id: { [Op.notIn]: catExtIds, [Op.ne]: null },
          deletedAt: null,
        },
        transaction: tx,
        paranoid: false,
      }
    );
    categorySoftDeleted = softCnt;
  });

  // 2) Staff (respect object_status)
  const { ACTIVE, ARCHIVE } = statusFilters('object_status');
  const [extActive, extArchived] = await Promise.all([
    ExtStaff.findAll({ where: ACTIVE }),
    ExtStaff.findAll({ where: ARCHIVE }),
  ]);
  const staffActiveIds = extActive.map((s) => s.id);
  const staffArchivedIds = extArchived.map((s) => s.id);
  const staffKnownIds = Array.from(
    new Set([...staffActiveIds, ...staffArchivedIds])
  );
  let staffUpserts = 0;
  let staffSoftDeletedMissing = 0;
  let staffSoftDeletedArchived = 0;
  await sequelize.transaction(async (tx) => {
    const locals = staffKnownIds.length
      ? await Staff.findAll({
          where: { external_id: { [Op.in]: staffKnownIds } },
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

    for (const s of extActive) {
      const local = localByExt.get(s.id);
      const desired = {
        surname: s.surname,
        name: s.name,
        patronymic: s.patronymic,
        date_of_birth: s.date_of_birth,
      };
      if (!local) {
        await Staff.create(
          {
            external_id: s.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        staffUpserts += 1;
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
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) staffUpserts += 1;
    }

    await ensureArchivedImported(
      Staff,
      extArchived,
      (s) => ({
        surname: s.surname,
        name: s.name,
        patronymic: s.patronymic,
        date_of_birth: s.date_of_birth,
      }),
      actorId,
      tx
    );

    const [archCnt] = await Staff.update(
      { deletedAt: new Date(), updated_by: actorId },
      {
        where: { external_id: { [Op.in]: staffArchivedIds }, deletedAt: null },
        transaction: tx,
        paranoid: false,
      }
    );
    staffSoftDeletedArchived = archCnt;

    if (staffKnownIds.length) {
      const [missCnt] = await Staff.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: staffKnownIds, [Op.ne]: null },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      staffSoftDeletedMissing = missCnt;
    }
  });

  // 3) ClubStaff and TeamStaff with ACTIVE/ARCHIVE handling (fallback to all if no status data)
  const { ACTIVE: CS_ACTIVE, ARCHIVE: CS_ARCHIVE } =
    statusFilters('object_status');
  let [clubStaffRows, clubStaffArchived] = await Promise.all([
    ExtClubStaff.findAll({ where: CS_ACTIVE }),
    ExtClubStaff.findAll({ where: CS_ARCHIVE }),
  ]);
  if (clubStaffRows.length === 0 && clubStaffArchived.length === 0) {
    clubStaffRows = await ExtClubStaff.findAll();
    clubStaffArchived = [];
  }
  const { ACTIVE: TS_ACTIVE, ARCHIVE: TS_ARCHIVE } =
    statusFilters('object_status');
  let [teamStaffRows, teamStaffArchived] = await Promise.all([
    ExtTeamStaff.findAll({ where: TS_ACTIVE }),
    ExtTeamStaff.findAll({ where: TS_ARCHIVE }),
  ]);
  if (teamStaffRows.length === 0 && teamStaffArchived.length === 0) {
    teamStaffRows = await ExtTeamStaff.findAll();
    teamStaffArchived = [];
  }

  const extClubIds = Array.from(
    new Set(
      [
        ...clubStaffRows.map((r) => r.club_id),
        ...clubStaffArchived.map((r) => r.club_id),
      ].filter(Boolean)
    )
  );
  const extTeamIds = Array.from(
    new Set(
      [
        ...teamStaffRows.map((r) => r.team_id),
        ...teamStaffArchived.map((r) => r.team_id),
      ].filter(Boolean)
    )
  );
  const extStaffIds = Array.from(
    new Set(
      [
        ...clubStaffRows.map((r) => r.staff_id),
        ...clubStaffArchived.map((r) => r.staff_id),
        ...teamStaffRows.map((r) => r.staff_id),
        ...teamStaffArchived.map((r) => r.staff_id),
      ].filter(Boolean)
    )
  );
  const extCategoryIds = Array.from(
    new Set(
      [
        ...clubStaffRows.map((r) => r.category_id),
        ...clubStaffArchived.map((r) => r.category_id),
      ].filter(Boolean)
    )
  );
  const extSeasonIds = Array.from(
    new Set(
      [
        ...clubStaffRows.map((r) => r.season_id),
        ...clubStaffArchived.map((r) => r.season_id),
      ].filter(Boolean)
    )
  );

  const [clubs, teams, staffs, categories, seasons] = await Promise.all([
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
    extStaffIds.length
      ? Staff.findAll({
          where: { external_id: { [Op.in]: extStaffIds } },
          paranoid: false,
        })
      : [],
    extCategoryIds.length
      ? StaffCategory.findAll({
          where: { external_id: { [Op.in]: extCategoryIds } },
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
  const staffIdByExt = new Map(staffs.map((s) => [s.external_id, s.id]));
  const categoryIdByExt = new Map(categories.map((c) => [c.external_id, c.id]));
  const seasonIdByExt = new Map(seasons.map((s) => [s.external_id, s.id]));

  // ClubStaff sync
  let clubStaffUpserts = 0;
  let clubStaffSoftDeletedMissing = 0;
  let clubStaffSoftDeletedArchived = 0;
  const clubStaffActiveIds = clubStaffRows.map((r) => r.id);
  const clubStaffArchivedIds = clubStaffArchived.map((r) => r.id);
  const clubStaffKnownIds = Array.from(
    new Set([...clubStaffActiveIds, ...clubStaffArchivedIds])
  );
  const clubStaffLocals = clubStaffKnownIds.length
    ? await ClubStaff.findAll({
        where: { external_id: { [Op.in]: clubStaffKnownIds } },
        paranoid: false,
      })
    : [];
  const clubStaffByExt = new Map(
    clubStaffLocals.map((x) => [x.external_id, x])
  );
  const clubStaffSeasonByExt = new Map(
    clubStaffLocals.map((x) => [x.external_id, x.season_id || null])
  );
  const clubStaffIdByExt = new Map(
    clubStaffLocals.map((x) => [x.external_id, x.id])
  );
  await sequelize.transaction(async (tx) => {
    for (const cs of clubStaffRows) {
      const staffId = staffIdByExt.get(cs.staff_id);
      if (!staffId) {
        logger.warn(
          'Skip club_staff %d: staff %d not found or archived',
          cs.id,
          cs.staff_id
        );
        continue;
      }
      const desired = {
        club_id: clubIdByExt.get(cs.club_id) || null,
        staff_id: staffId,
        category_id: categoryIdByExt.get(cs.category_id) || null,
        season_id: seasonIdByExt.get(cs.season_id) || null,
      };
      const local = clubStaffByExt.get(cs.id);
      if (!local) {
        const created = await ClubStaff.create(
          {
            external_id: cs.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        clubStaffUpserts += 1;
        clubStaffIdByExt.set(cs.id, created.id);
        clubStaffSeasonByExt.set(cs.id, desired.season_id || null);
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (local.club_id !== desired.club_id) updates.club_id = desired.club_id;
      if (local.staff_id !== desired.staff_id)
        updates.staff_id = desired.staff_id;
      if (local.category_id !== desired.category_id)
        updates.category_id = desired.category_id;
      if (local.season_id !== desired.season_id)
        updates.season_id = desired.season_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        if (Object.prototype.hasOwnProperty.call(updates, 'season_id')) {
          clubStaffSeasonByExt.set(cs.id, updates.season_id || null);
        }
        changed = true;
      }
      if (changed) clubStaffUpserts += 1;
    }

    // Ensure archived external contract rows exist locally as soft-deleted
    const createdArchivedCs = await ensureArchivedImported(
      ClubStaff,
      clubStaffArchived,
      (cs) => ({
        club_id: clubIdByExt.get(cs.club_id) || null,
        staff_id: staffIdByExt.get(cs.staff_id) || null,
        category_id: categoryIdByExt.get(cs.category_id) || null,
        season_id: seasonIdByExt.get(cs.season_id) || null,
      }),
      actorId,
      tx
    );
    clubStaffUpserts += createdArchivedCs;

    // Soft-delete explicitly archived
    if (clubStaffArchivedIds.length) {
      const [archCnt] = await ClubStaff.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.in]: clubStaffArchivedIds },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      clubStaffSoftDeletedArchived = archCnt;
    }

    // Soft-delete missing
    if (clubStaffKnownIds.length) {
      const [missCnt] = await ClubStaff.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: clubStaffKnownIds, [Op.ne]: null },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      clubStaffSoftDeletedMissing = missCnt;
    }
  });

  // TeamStaff sync
  let teamStaffUpserts = 0;
  let teamStaffSoftDeletedMissing = 0;
  let teamStaffSoftDeletedArchived = 0;
  const teamStaffActiveIds = teamStaffRows.map((r) => r.id);
  const teamStaffArchivedIds = teamStaffArchived.map((r) => r.id);
  const teamStaffKnownIds = Array.from(
    new Set([...teamStaffActiveIds, ...teamStaffArchivedIds])
  );
  const teamStaffLocals = teamStaffKnownIds.length
    ? await TeamStaff.findAll({
        where: { external_id: { [Op.in]: teamStaffKnownIds } },
        paranoid: false,
      })
    : [];
  const teamStaffByExt = new Map(
    teamStaffLocals.map((x) => [x.external_id, x])
  );
  await sequelize.transaction(async (tx) => {
    for (const ts of teamStaffRows) {
      const staffId = staffIdByExt.get(ts.staff_id);
      const teamId = teamIdByExt.get(ts.team_id);
      if (!staffId || !teamId) {
        logger.warn(
          'Skip team_staff %d: missing refs staff=%s team=%s',
          ts.id,
          String(ts.staff_id),
          String(ts.team_id)
        );
        continue;
      }
      const desired = {
        team_id: teamId,
        staff_id: staffId,
        club_staff_id: clubStaffIdByExt.get(ts.contract_id) || null,
        season_id: clubStaffSeasonByExt.get(ts.contract_id) || null,
      };
      const local = teamStaffByExt.get(ts.id);
      if (!local) {
        await TeamStaff.create(
          {
            external_id: ts.id,
            ...desired,
            created_by: actorId,
            updated_by: actorId,
          },
          { transaction: tx }
        );
        teamStaffUpserts += 1;
        continue;
      }
      let changed = false;
      if (local.deletedAt) {
        await local.restore({ transaction: tx });
        changed = true;
      }
      const updates = {};
      if (local.team_id !== desired.team_id) updates.team_id = desired.team_id;
      if (local.staff_id !== desired.staff_id)
        updates.staff_id = desired.staff_id;
      if (local.club_staff_id !== desired.club_staff_id)
        updates.club_staff_id = desired.club_staff_id;
      if (local.season_id !== desired.season_id)
        updates.season_id = desired.season_id;
      if (Object.keys(updates).length) {
        updates.updated_by = actorId;
        await local.update(updates, { transaction: tx });
        changed = true;
      }
      if (changed) teamStaffUpserts += 1;
    }

    // Ensure archived links exist locally as soft-deleted
    const createdArchivedTs = await ensureArchivedImported(
      TeamStaff,
      teamStaffArchived,
      (ts) => ({
        team_id: teamIdByExt.get(ts.team_id) || null,
        staff_id: staffIdByExt.get(ts.staff_id) || null,
        club_staff_id: clubStaffIdByExt.get(ts.contract_id) || null,
        season_id: clubStaffSeasonByExt.get(ts.contract_id) || null,
      }),
      actorId,
      tx
    );
    teamStaffUpserts += createdArchivedTs;

    // Soft-delete archived
    if (teamStaffArchivedIds.length) {
      const [archCnt] = await TeamStaff.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.in]: teamStaffArchivedIds },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      teamStaffSoftDeletedArchived = archCnt;
    }

    // Soft-delete missing
    if (teamStaffKnownIds.length) {
      const [missCnt] = await TeamStaff.update(
        { deletedAt: new Date(), updated_by: actorId },
        {
          where: {
            external_id: { [Op.notIn]: teamStaffKnownIds, [Op.ne]: null },
            deletedAt: null,
          },
          transaction: tx,
          paranoid: false,
        }
      );
      teamStaffSoftDeletedMissing = missCnt;
    }
  });

  logger.info(
    'Staff sync: staff upserted=%d, softDeleted=%d (archived=%d, missing=%d); categories upserted=%d, softDeleted=%d; clubStaff upserted=%d, softDeleted=%d (archived=%d, missing=%d); teamStaff upserted=%d, softDeleted=%d (archived=%d, missing=%d)',
    staffUpserts,
    staffSoftDeletedMissing + staffSoftDeletedArchived,
    staffSoftDeletedArchived,
    staffSoftDeletedMissing,
    categoryUpserts,
    categorySoftDeleted,
    clubStaffUpserts,
    clubStaffSoftDeletedMissing + clubStaffSoftDeletedArchived,
    clubStaffSoftDeletedArchived,
    clubStaffSoftDeletedMissing,
    teamStaffUpserts,
    teamStaffSoftDeletedMissing + teamStaffSoftDeletedArchived,
    teamStaffSoftDeletedArchived,
    teamStaffSoftDeletedMissing
  );

  return {
    staff: {
      upserts: staffUpserts,
      softDeletedTotal: staffSoftDeletedMissing + staffSoftDeletedArchived,
      softDeletedArchived: staffSoftDeletedArchived,
      softDeletedMissing: staffSoftDeletedMissing,
    },
    staff_categories: {
      upserts: categoryUpserts,
      softDeletedTotal: categorySoftDeleted,
    },
    club_staff: {
      upserts: clubStaffUpserts,
      softDeletedTotal:
        clubStaffSoftDeletedMissing + clubStaffSoftDeletedArchived,
      softDeletedArchived: clubStaffSoftDeletedArchived,
      softDeletedMissing: clubStaffSoftDeletedMissing,
    },
    team_staff: {
      upserts: teamStaffUpserts,
      softDeletedTotal:
        teamStaffSoftDeletedMissing + teamStaffSoftDeletedArchived,
      softDeletedArchived: teamStaffSoftDeletedArchived,
      softDeletedMissing: teamStaffSoftDeletedMissing,
    },
  };
}

async function list(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, parseInt(options.limit || 20, 10));
  const offset = (page - 1) * limit;

  const where = {};
  if (options.search) {
    const term = `%${options.search}%`;
    where[Op.or] = [
      { surname: { [Op.iLike]: term } },
      { name: { [Op.iLike]: term } },
      { patronymic: { [Op.iLike]: term } },
    ];
  }

  const status = String(options.status || 'ACTIVE').toUpperCase();
  const paranoid = !(status === 'ARCHIVED' || status === 'ALL');
  if (status === 'ARCHIVED') where.deleted_at = { [Op.ne]: null };

  const include = [];
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
        ? { where: throughWhere, attributes: ['season_id', 'category_id'] }
        : { attributes: ['season_id', 'category_id'] },
    });
  } else if (options.includeClubs) {
    include.push({
      model: Club,
      required: false,
      through: { attributes: ['season_id', 'category_id'] },
    });
  }

  if (options.teamId || options.includeTeams) {
    const teamInclude = { model: Team, required: Boolean(options.teamId) };
    if (options.teamId) teamInclude.where = { id: options.teamId };
    if (options.seasonId)
      teamInclude.through = { where: { season_id: options.seasonId } };
    include.push(teamInclude);
  }

  return Staff.findAndCountAll({
    where,
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

export default { syncExternal, list };
