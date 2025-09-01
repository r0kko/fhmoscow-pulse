import { Op, fn, col } from 'sequelize';

import {
  Tournament,
  TournamentType,
  Stage,
  TournamentGroup,
  TournamentTeam,
  Season,
  Team,
} from '../models/index.js';

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
    order: [[{ model: Season }, 'name', 'ASC'], ['name', 'ASC']],
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

async function listStages({ page = 1, limit = 20, tournament_id, status }) {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.max(1, parseInt(limit, 10));
  const offset = (p - 1) * l;

  const where = {};
  if (tournament_id) where.tournament_id = tournament_id;

  const { paranoid, onlyArchived } = statusToParanoid(status);
  if (onlyArchived) where.deleted_at = { [Op.ne]: null };

  const include = [
    { model: Tournament, include: [{ model: Season }, { model: TournamentType }] },
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
};
