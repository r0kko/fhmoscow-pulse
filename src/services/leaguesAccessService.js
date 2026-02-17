import { Op } from 'sequelize';

import ServiceError from '../errors/ServiceError.js';
import userMapper from '../mappers/userMapper.js';
import {
  CompetitionType,
  LeaguesAccess,
  Role,
  Season,
  User,
  UserStatus,
} from '../models/index.js';

import seasonService from './seasonService.js';

const ELIGIBLE_REFEREE_ROLES = ['REFEREE', 'BRIGADE_REFEREE'];

function normalizeCompetitionAlias(rawAlias = '') {
  const value = String(rawAlias || '')
    .trim()
    .toUpperCase();
  if (!value) return '';
  const isProLike =
    value === 'PRO' ||
    value === 'PROFESSIONAL' ||
    value === 'ПРО' ||
    value.includes('ПРОФ') ||
    value.includes('PROF');
  if (isProLike) return 'PRO';
  return value;
}

function buildCompetitionNameFallbackWhere(normalizedAlias) {
  if (!normalizedAlias) return null;
  if (normalizedAlias === 'PRO') {
    return {
      [Op.or]: [
        { name: { [Op.iLike]: '%проф%' } },
        { name: { [Op.iLike]: '%professional%' } },
      ],
    };
  }
  if (normalizedAlias.length < 3) return null;
  return {
    [Op.or]: [{ name: { [Op.iLike]: `%${normalizedAlias}%` } }],
  };
}

async function resolveCompetitionType({
  competitionTypeId = null,
  competitionAlias = 'PRO',
} = {}) {
  if (competitionTypeId) {
    const byId = await CompetitionType.findByPk(competitionTypeId);
    if (!byId) throw new ServiceError('competition_type_not_found', 404);
    return byId;
  }

  const normalizedAlias = normalizeCompetitionAlias(competitionAlias);
  if (!normalizedAlias) {
    throw new ServiceError('competition_type_not_found', 404);
  }

  const byAlias = await CompetitionType.findOne({
    where: { alias: normalizedAlias },
  });
  if (byAlias) return byAlias;

  const fallbackWhere = buildCompetitionNameFallbackWhere(normalizedAlias);
  if (!fallbackWhere) {
    throw new ServiceError('competition_type_not_found', 404);
  }
  const byName = await CompetitionType.findOne({
    where: fallbackWhere,
    order: [['name', 'ASC']],
  });
  if (!byName) throw new ServiceError('competition_type_not_found', 404);
  return byName;
}

async function resolveSeason({ seasonId = null, seasonMode = 'current' } = {}) {
  if (seasonId) {
    const season = await Season.findByPk(seasonId);
    if (!season) throw new ServiceError('season_not_found', 404);
    return season;
  }
  if (seasonMode && seasonMode !== 'current') {
    throw new ServiceError('invalid_season_mode', 400);
  }
  const season = await seasonService.getActive();
  if (!season) throw new ServiceError('season_not_found', 404);
  return season;
}

async function resolveContext({
  seasonId = null,
  seasonMode = 'current',
  competitionTypeId = null,
  competitionAlias = 'PRO',
} = {}) {
  const [season, competitionType] = await Promise.all([
    resolveSeason({ seasonId, seasonMode }),
    resolveCompetitionType({ competitionTypeId, competitionAlias }),
  ]);
  return { season, competitionType };
}

function normalizeSearch(raw = '') {
  return String(raw || '').trim();
}

function buildUserSearchWhere(search = '') {
  const term = normalizeSearch(search);
  if (!term) return {};
  const pattern = `%${term}%`;
  return {
    [Op.or]: [
      { last_name: { [Op.iLike]: pattern } },
      { first_name: { [Op.iLike]: pattern } },
      { patronymic: { [Op.iLike]: pattern } },
      { phone: { [Op.iLike]: pattern } },
      { email: { [Op.iLike]: pattern } },
    ],
  };
}

function mapAccessRow(row, season, competitionType) {
  return {
    id: row.id,
    season: season
      ? {
          id: season.id,
          name: season.name,
          alias: season.alias,
          active: Boolean(season.active),
        }
      : null,
    competition_type: competitionType
      ? {
          id: competitionType.id,
          alias: competitionType.alias,
          name: competitionType.name,
        }
      : null,
    user: userMapper.toPublic(row.User),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

async function listAccesses(options = {}) {
  const { search = '' } = options;
  const { season, competitionType } = await resolveContext(options);
  const rows = await LeaguesAccess.findAll({
    where: {
      season_id: season.id,
      competition_type_id: competitionType.id,
    },
    include: [
      {
        model: User,
        required: true,
        where: buildUserSearchWhere(search),
        include: [
          {
            model: Role,
            through: { attributes: [] },
            required: false,
          },
          { model: UserStatus, required: false },
        ],
      },
    ],
    order: [
      [User, 'last_name', 'ASC'],
      [User, 'first_name', 'ASC'],
    ],
  });
  return {
    season: {
      id: season.id,
      name: season.name,
      alias: season.alias,
      active: Boolean(season.active),
    },
    competition_type: {
      id: competitionType.id,
      alias: competitionType.alias,
      name: competitionType.name,
    },
    accesses: rows.map((row) => mapAccessRow(row, season, competitionType)),
  };
}

async function listCandidates(options = {}) {
  const { search = '' } = options;
  const { season, competitionType } = await resolveContext(options);
  const accessRows = await LeaguesAccess.findAll({
    where: {
      season_id: season.id,
      competition_type_id: competitionType.id,
    },
    attributes: ['user_id'],
  });
  const excludedUserIds = accessRows.map((row) => row.user_id);
  const where = buildUserSearchWhere(search);
  if (excludedUserIds.length) {
    where.id = { [Op.notIn]: excludedUserIds };
  }

  const rawUsers = await User.findAll({
    where,
    include: [
      {
        model: Role,
        where: { alias: { [Op.in]: ELIGIBLE_REFEREE_ROLES } },
        through: { attributes: [] },
        required: true,
      },
      {
        model: UserStatus,
        where: { alias: 'ACTIVE' },
        required: true,
      },
    ],
    order: [
      ['last_name', 'ASC'],
      ['first_name', 'ASC'],
    ],
  });

  const uniqueUsers = [];
  const seen = new Set();
  rawUsers.forEach((user) => {
    if (!user?.id || seen.has(user.id)) return;
    seen.add(user.id);
    uniqueUsers.push(user);
  });

  return {
    season: {
      id: season.id,
      name: season.name,
      alias: season.alias,
      active: Boolean(season.active),
    },
    competition_type: {
      id: competitionType.id,
      alias: competitionType.alias,
      name: competitionType.name,
    },
    users: uniqueUsers.map((user) => userMapper.toPublic(user)),
  };
}

async function ensureEligibleUser(userId) {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: Role,
        where: { alias: { [Op.in]: ELIGIBLE_REFEREE_ROLES } },
        through: { attributes: [] },
        required: false,
      },
      {
        model: UserStatus,
        required: false,
      },
    ],
  });
  if (!user) throw new ServiceError('user_not_found', 404);
  if (user.UserStatus?.alias !== 'ACTIVE') {
    throw new ServiceError('user_inactive', 400);
  }
  if (!Array.isArray(user.Roles) || !user.Roles.length) {
    throw new ServiceError('user_not_referee', 400);
  }
  return user;
}

async function loadAccessById(id) {
  return LeaguesAccess.findByPk(id, {
    include: [
      {
        model: User,
        include: [
          { model: Role, through: { attributes: [] }, required: false },
          { model: UserStatus, required: false },
        ],
      },
      { model: Season },
      { model: CompetitionType },
    ],
  });
}

async function grantAccess(data = {}, actorId) {
  const {
    user_id: userId,
    season_id: seasonId = null,
    season_mode: seasonMode = 'current',
    competition_type_id: competitionTypeId = null,
    competition_alias: competitionAlias = 'PRO',
  } = data || {};
  await ensureEligibleUser(userId);
  const { season, competitionType } = await resolveContext({
    seasonId,
    seasonMode,
    competitionTypeId,
    competitionAlias,
  });

  let row = await LeaguesAccess.findOne({
    where: {
      season_id: season.id,
      user_id: userId,
      competition_type_id: competitionType.id,
    },
    paranoid: false,
  });

  if (row) {
    if (row.deletedAt) {
      await row.restore();
    }
    await row.update({ updated_by: actorId });
  } else {
    row = await LeaguesAccess.create({
      season_id: season.id,
      user_id: userId,
      competition_type_id: competitionType.id,
      created_by: actorId,
      updated_by: actorId,
    });
  }

  const withIncludes = await loadAccessById(row.id);
  if (!withIncludes) throw new ServiceError('league_access_not_found', 404);
  return mapAccessRow(
    withIncludes,
    withIncludes.Season,
    withIncludes.CompetitionType
  );
}

async function revokeAccess(id, actorId = null) {
  const row = await LeaguesAccess.findByPk(id);
  if (!row) throw new ServiceError('league_access_not_found', 404);
  await row.update({ updated_by: actorId });
  await row.destroy();
}

async function getCurrentMeta(options = {}) {
  const { season, competitionType } = await resolveContext(options);
  return {
    season: {
      id: season.id,
      name: season.name,
      alias: season.alias,
      active: Boolean(season.active),
    },
    competition_type: {
      id: competitionType.id,
      alias: competitionType.alias,
      name: competitionType.name,
    },
  };
}

export default {
  getCurrentMeta,
  listAccesses,
  listCandidates,
  grantAccess,
  revokeAccess,
};
