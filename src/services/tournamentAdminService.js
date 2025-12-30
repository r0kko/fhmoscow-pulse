import { Op, fn, col } from 'sequelize';

import {
  Tournament,
  TournamentType,
  Stage,
  TournamentGroup,
  TournamentTeam,
  RefereeRoleGroup,
  RefereeRole,
  TournamentGroupReferee,
  Season,
  Team,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';
import sequelize from '../config/database.js';

function statusToParanoid(status) {
  const s = String(status || 'ACTIVE').toUpperCase();
  return s === 'ACTIVE'
    ? { paranoid: true, onlyArchived: false }
    : s === 'ARCHIVED'
      ? { paranoid: false, onlyArchived: true }
      : { paranoid: false, onlyArchived: false };
}

async function listTournaments({
  page = 1,
  limit = 20,
  search,
  season_id,
  type_id,
  birth_year,
  status,
}) {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.max(1, parseInt(limit, 10));
  const offset = (p - 1) * l;

  const where = {};
  if (search) where.name = { [Op.iLike]: `%${search}%` };
  if (season_id) where.season_id = season_id;
  if (type_id) where.type_id = type_id;
  if (birth_year) where.birth_year = parseInt(birth_year, 10);

  const { paranoid, onlyArchived } = statusToParanoid(status);
  if (onlyArchived) where.deleted_at = { [Op.ne]: null };

  const include = [{ model: Season }, { model: TournamentType }];
  const { rows, count } = await Tournament.findAndCountAll({
    include,
    where,
    paranoid,
    order: [
      [{ model: Season }, 'name', 'ASC'],
      ['name', 'ASC'],
    ],
    limit: l,
    offset,
  });

  // Aggregate counts for stages, groups, teams to avoid N+1
  const ids = rows.map((r) => r.id);
  let stageCounts = new Map();
  let groupCounts = new Map();
  let teamCounts = new Map();
  if (ids.length) {
    const [stagesAgg, groupsAgg, teamsAgg] = await Promise.all([
      Stage.findAll({
        attributes: ['tournament_id', [fn('COUNT', col('*')), 'cnt']],
        where: { tournament_id: { [Op.in]: ids } },
        group: ['tournament_id'],
        raw: true,
        paranoid,
      }),
      TournamentGroup.findAll({
        attributes: ['tournament_id', [fn('COUNT', col('*')), 'cnt']],
        where: { tournament_id: { [Op.in]: ids } },
        group: ['tournament_id'],
        raw: true,
        paranoid,
      }),
      TournamentTeam.findAll({
        attributes: ['tournament_id', [fn('COUNT', col('*')), 'cnt']],
        where: { tournament_id: { [Op.in]: ids } },
        group: ['tournament_id'],
        raw: true,
        paranoid,
      }),
    ]);
    stageCounts = new Map(
      stagesAgg.map((r) => [r.tournament_id, Number(r.cnt)])
    );
    groupCounts = new Map(
      groupsAgg.map((r) => [r.tournament_id, Number(r.cnt)])
    );
    teamCounts = new Map(teamsAgg.map((r) => [r.tournament_id, Number(r.cnt)]));
  }

  const out = rows.map((r) => {
    const t = r.get ? r.get({ plain: true }) : r;
    t.counts = {
      stages: stageCounts.get(t.id) || 0,
      groups: groupCounts.get(t.id) || 0,
      teams: teamCounts.get(t.id) || 0,
    };
    return t;
  });
  return { rows: out, count };
}

function normalizeString(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeDurationMinutes(value) {
  if (value === '' || value == null) return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 24 * 60) {
    throw new ServiceError('invalid_match_duration', 400);
  }
  return parsed;
}

function assertManualTournament(tournament) {
  if (tournament?.external_id != null) {
    throw new ServiceError('tournament_is_imported', 409);
  }
}

async function ensureTournament(id) {
  if (!id) return null;
  const tournament = await Tournament.findByPk(id);
  if (!tournament) throw new ServiceError('tournament_not_found', 404);
  return tournament;
}

async function ensureStage(id) {
  if (!id) return null;
  const stage = await Stage.findByPk(id);
  if (!stage) throw new ServiceError('stage_not_found', 404);
  return stage;
}

async function ensureGroup(id) {
  if (!id) return null;
  const group = await TournamentGroup.findByPk(id);
  if (!group) throw new ServiceError('group_not_found', 404);
  return group;
}

async function listStages({ page = 1, limit = 20, tournament_id, status }) {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.max(1, parseInt(limit, 10));
  const offset = (p - 1) * l;

  const where = {};
  if (tournament_id) where.tournament_id = tournament_id;

  const { paranoid, onlyArchived } = statusToParanoid(status);
  if (onlyArchived) where.deleted_at = { [Op.ne]: null };

  const include = [
    {
      model: Tournament,
      include: [{ model: Season }, { model: TournamentType }],
    },
  ];
  return Stage.findAndCountAll({
    include,
    where,
    paranoid,
    order: [[{ model: Tournament }, { model: Season }, 'name', 'ASC']],
    limit: l,
    offset,
  });
}

async function listGroups({
  page = 1,
  limit = 20,
  search,
  tournament_id,
  stage_id,
  status,
}) {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.max(1, parseInt(limit, 10));
  const offset = (p - 1) * l;

  const where = {};
  if (search) where.name = { [Op.iLike]: `%${search}%` };
  if (tournament_id) where.tournament_id = tournament_id;
  if (stage_id) where.stage_id = stage_id;

  const { paranoid, onlyArchived } = statusToParanoid(status);
  if (onlyArchived) where.deleted_at = { [Op.ne]: null };

  const include = [
    { model: Tournament, include: [{ model: Season }] },
    { model: Stage },
  ];
  return TournamentGroup.findAndCountAll({
    include,
    where,
    paranoid,
    order: [
      [{ model: Tournament }, { model: Season }, 'name', 'ASC'],
      ['name', 'ASC'],
    ],
    limit: l,
    offset,
  });
}

async function listTournamentTeams({
  page = 1,
  limit = 20,
  search,
  tournament_id,
  group_id,
  team_id,
  status,
}) {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.max(1, parseInt(limit, 10));
  const offset = (p - 1) * l;

  const where = {};
  if (tournament_id) where.tournament_id = tournament_id;
  if (group_id) where.tournament_group_id = group_id;
  if (team_id) where.team_id = team_id;

  const { paranoid, onlyArchived } = statusToParanoid(status);
  if (onlyArchived) where.deleted_at = { [Op.ne]: null };

  // Optional search by team name
  const include = [
    { model: Tournament },
    { model: TournamentGroup },
    search
      ? { model: Team, where: { name: { [Op.iLike]: `%${search}%` } } }
      : { model: Team },
  ];

  return TournamentTeam.findAndCountAll({
    include,
    where,
    paranoid,
    order: [[{ model: Team }, 'name', 'ASC']],
    limit: l,
    offset,
  });
}

export default {
  async listTypes() {
    return TournamentType.findAll({ order: [['name', 'ASC']] });
  },
  listTournaments,
  listStages,
  listGroups,
  listTournamentTeams,
  async createTournament(data = {}, actorId = null) {
    const name = normalizeString(data.name);
    if (!name) throw new ServiceError('invalid_tournament_name', 400);

    const seasonId = data.season_id || null;
    if (seasonId) {
      const season = await Season.findByPk(seasonId);
      if (!season) throw new ServiceError('season_not_found', 404);
    }

    const typeId = data.type_id || null;
    if (typeId) {
      const type = await TournamentType.findByPk(typeId);
      if (!type) throw new ServiceError('tournament_type_not_found', 404);
    }

    let birthYear = null;
    if (data.birth_year !== undefined && data.birth_year !== null) {
      const parsed = Number.parseInt(String(data.birth_year), 10);
      if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 2100) {
        throw new ServiceError('invalid_birth_year', 400);
      }
      birthYear = parsed;
    }

    return Tournament.create({
      external_id: null,
      name,
      full_name: normalizeString(data.full_name),
      birth_year: birthYear,
      season_id: seasonId,
      type_id: typeId,
      created_by: actorId,
      updated_by: actorId,
    });
  },
  async createStage(data = {}, actorId = null) {
    const tournamentId = data.tournament_id;
    if (!tournamentId) throw new ServiceError('tournament_not_found', 404);
    const tournament = await ensureTournament(tournamentId);
    assertManualTournament(tournament);

    const name = normalizeString(data.name);

    return Stage.create({
      external_id: null,
      tournament_id: tournamentId,
      name,
      created_by: actorId,
      updated_by: actorId,
    });
  },
  async createGroup(data = {}, actorId = null) {
    const tournamentId = data.tournament_id;
    const stageId = data.stage_id;
    if (!tournamentId) throw new ServiceError('tournament_not_found', 404);
    if (!stageId) throw new ServiceError('stage_not_found', 404);

    const [tournament, stage] = await Promise.all([
      ensureTournament(tournamentId),
      ensureStage(stageId),
    ]);
    assertManualTournament(tournament);
    if (stage.tournament_id && stage.tournament_id !== tournament.id) {
      throw new ServiceError('stage_tournament_mismatch', 400);
    }

    const name = normalizeString(data.name);
    const matchDurationMinutes = normalizeDurationMinutes(
      data.match_duration_minutes
    );

    return TournamentGroup.create({
      external_id: null,
      tournament_id: tournament.id,
      stage_id: stage.id,
      name,
      match_duration_minutes: matchDurationMinutes,
      created_by: actorId,
      updated_by: actorId,
    });
  },
  async updateGroup(id, data = {}, actorId = null) {
    const group = await TournamentGroup.findByPk(id);
    if (!group) throw new ServiceError('group_not_found', 404);

    const updates = {
      updated_by: actorId,
    };

    if (data.name !== undefined) {
      updates.name = normalizeString(data.name);
    }

    if (data.match_duration_minutes !== undefined) {
      updates.match_duration_minutes = normalizeDurationMinutes(
        data.match_duration_minutes
      );
    }

    await group.update(updates, { returning: false });
    return group;
  },
  async listRefereeRoleGroups() {
    return RefereeRoleGroup.findAll({
      include: [{ model: RefereeRole }],
      order: [
        ['sort_order', 'ASC'],
        ['name', 'ASC'],
        [{ model: RefereeRole }, 'sort_order', 'ASC'],
        [{ model: RefereeRole }, 'name', 'ASC'],
      ],
    });
  },
  async listGroupReferees({ tournament_id }) {
    if (!tournament_id) return [];
    const groups = await TournamentGroup.findAll({
      attributes: ['id'],
      where: { tournament_id },
      raw: true,
    });
    const groupIds = groups.map((g) => g.id);
    if (!groupIds.length) return [];
    return TournamentGroupReferee.findAll({
      attributes: ['tournament_group_id', 'referee_role_id', 'count'],
      where: { tournament_group_id: { [Op.in]: groupIds } },
      raw: true,
    });
  },
  async updateGroupReferees(groupId, roles = [], actorId = null) {
    const group = await ensureGroup(groupId);
    if (!Array.isArray(roles)) {
      throw new ServiceError('referee_roles_required', 400);
    }
    const unique = new Map();
    for (const role of roles) {
      if (!role || typeof role.role_id !== 'string') {
        throw new ServiceError('referee_role_not_found', 404);
      }
      if (!Number.isFinite(role.count) || role.count < 0 || role.count > 2) {
        throw new ServiceError('invalid_referee_count', 400);
      }
      unique.set(role.role_id, role.count);
    }
    const roleIds = [...unique.keys()];
    if (roleIds.length) {
      const existing = await RefereeRole.findAll({
        where: { id: { [Op.in]: roleIds } },
        attributes: ['id'],
      });
      if (existing.length !== roleIds.length) {
        throw new ServiceError('referee_role_not_found', 404);
      }
    }
    const payload = roleIds
      .filter((id) => unique.get(id) > 0)
      .map((id) => ({
        tournament_group_id: group.id,
        referee_role_id: id,
        count: unique.get(id),
        created_by: actorId,
        updated_by: actorId,
      }));
    await sequelize.transaction(async (tx) => {
      await TournamentGroupReferee.destroy({
        where: { tournament_group_id: group.id },
        force: true,
        transaction: tx,
      });
      if (payload.length) {
        await TournamentGroupReferee.bulkCreate(payload, { transaction: tx });
      }
    });
    return payload.map((row) => ({
      tournament_group_id: row.tournament_group_id,
      referee_role_id: row.referee_role_id,
      count: row.count,
    }));
  },
};
