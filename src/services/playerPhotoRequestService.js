import { Op } from 'sequelize';

import sequelize from '../config/database.js';
import ServiceError from '../errors/ServiceError.js';
import {
  Club,
  ClubPlayer,
  ExtFile,
  File,
  Player,
  PlayerPhotoRequest,
  PlayerPhotoRequestStatus,
  Team,
  TeamPlayer,
  User,
} from '../models/index.js';

import fileService from './fileService.js';
import { processPlayerPhotoApproval } from './playerPhotoApprovalWorkflow.js';

const STATUS_ALIASES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const statusCache = new Map();
const SQL_SINGLE_QUOTE = '\u0027';

async function getStatusByAlias(alias, options = {}) {
  if (!alias) throw new ServiceError('photo_request_status_invalid', 500);
  if (!options.transaction && statusCache.has(alias)) {
    return statusCache.get(alias);
  }
  const status = await PlayerPhotoRequestStatus.findOne({
    where: { alias },
    transaction: options.transaction,
  });
  if (!status) {
    throw new ServiceError('photo_request_status_missing', 500);
  }
  if (!options.transaction) statusCache.set(alias, status);
  return status;
}

function escapeLikePattern(value) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function quoteLiteral(value) {
  const str = String(value ?? '');
  const escaped = str.replace(/'/g, SQL_SINGLE_QUOTE.repeat(2));
  return `${SQL_SINGLE_QUOTE}${escaped}${SQL_SINGLE_QUOTE}`;
}

function normalizeTokens(input) {
  if (!input) return [];
  const normalized = String(input)
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
  if (!normalized) return [];
  const seen = new Set();
  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  const result = [];
  for (const token of tokens) {
    if (token.length < 2 && !/^\d+$/.test(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }
  return result.slice(0, 5);
}

function buildPlayerSearchClause(rawSearch) {
  const tokens = normalizeTokens(rawSearch);
  if (!tokens.length) return null;
  const clauses = tokens.map((token) => {
    const pattern = `%${escapeLikePattern(token)}%`;
    const escapedPattern = quoteLiteral(pattern);
    const textComparators = ['surname', 'name', 'patronymic']
      .map(
        (column) =>
          `LOWER(COALESCE(p.${column}, '')) LIKE ${escapedPattern} ESCAPE '\\'`
      )
      .join(' OR ');
    const numericComparator = /^\d+$/.test(token)
      ? ` OR CAST(p.external_id AS TEXT) LIKE ${escapedPattern} ESCAPE '\\'`
      : '';
    return `(${textComparators}${numericComparator})`;
  });
  return `EXISTS (
    SELECT 1
    FROM players p
    WHERE p.id = "PlayerPhotoRequest"."player_id"
      AND p.deleted_at IS NULL
      AND ${clauses.join(' AND ')}
  )`;
}

function normalizeIdList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of values) {
    if (!raw && raw !== 0) continue;
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function toLiteral(value) {
  if (!value) return null;
  if (typeof sequelize.literal === 'function') {
    return sequelize.literal(value);
  }
  return { val: value };
}

function buildClubFilterClause(ids) {
  const normalized = normalizeIdList(ids);
  if (!normalized.length) return null;
  const list = normalized.map((id) => quoteLiteral(id)).join(', ');
  if (!list) return null;
  return `EXISTS (
    SELECT 1
    FROM club_players cp
    WHERE cp.player_id = "PlayerPhotoRequest"."player_id"
      AND cp.deleted_at IS NULL
      AND cp.club_id IN (${list})
  )`;
}

function buildTeamFilterClause(ids) {
  const normalized = normalizeIdList(ids);
  if (!normalized.length) return null;
  const list = normalized.map((id) => quoteLiteral(id)).join(', ');
  if (!list) return null;
  return `EXISTS (
    SELECT 1
    FROM team_players tp
    WHERE tp.player_id = "PlayerPhotoRequest"."player_id"
      AND tp.deleted_at IS NULL
      AND tp.team_id IN (${list})
  )`;
}

async function submit({ actorId, playerId, file, scope = {} }) {
  if (!playerId) {
    throw new ServiceError('player_id_required', 400);
  }
  if (!file) {
    throw new ServiceError('file_required', 400);
  }
  const player = await Player.findByPk(playerId);
  if (!player) {
    throw new ServiceError('player_not_found', 404);
  }

  const isAdmin = Boolean(scope.isAdmin);
  if (!isAdmin) {
    const allowedClubIds = (scope.allowedClubIds || []).map((id) => String(id));
    const allowedTeamIds = (scope.allowedTeamIds || []).map((id) => String(id));
    if (!allowedClubIds.length && !allowedTeamIds.length) {
      throw new ServiceError('photo_request_forbidden', 403);
    }
    const [clubCount, teamCount] = await Promise.all([
      allowedClubIds.length
        ? ClubPlayer.count({
            where: {
              player_id: playerId,
              club_id: { [Op.in]: allowedClubIds },
              deleted_at: null,
            },
          })
        : Promise.resolve(0),
      allowedTeamIds.length
        ? TeamPlayer.count({
            where: {
              player_id: playerId,
              team_id: { [Op.in]: allowedTeamIds },
              deleted_at: null,
            },
          })
        : Promise.resolve(0),
    ]);
    if (!clubCount && !teamCount) {
      throw new ServiceError('photo_request_forbidden', 403);
    }
  }

  const activeRequest = await PlayerPhotoRequest.findOne({
    where: { player_id: playerId },
    include: [
      {
        model: PlayerPhotoRequestStatus,
        as: 'Status',
        required: true,
        attributes: ['alias'],
        where: {
          alias: STATUS_ALIASES.PENDING,
        },
      },
    ],
  });
  if (activeRequest) {
    throw new ServiceError('photo_request_already_exists', 400);
  }

  const uploadedFile = await fileService.uploadPlayerPhoto(
    playerId,
    file,
    actorId
  );

  try {
    return await sequelize.transaction(async (tx) => {
      const pendingStatus = await getStatusByAlias(STATUS_ALIASES.PENDING, {
        transaction: tx,
      });

      const created = await PlayerPhotoRequest.create(
        {
          player_id: playerId,
          file_id: uploadedFile.id,
          status_id: pendingStatus.id,
          created_by: actorId,
          updated_by: actorId,
        },
        { transaction: tx }
      );
      return findById(created.id, { transaction: tx });
    });
  } catch (err) {
    await fileService.removeFile(uploadedFile.id).catch(() => {});
    if (
      err?.original?.code === '23505' ||
      err?.name === 'SequelizeUniqueConstraintError'
    ) {
      throw new ServiceError('photo_request_already_exists', 400);
    }
    throw err;
  }
}

async function list(options = {}) {
  const page = Math.max(1, parseInt(options.page || 1, 10));
  const limit = Math.max(1, Math.min(100, parseInt(options.limit || 25, 10)));
  const offset = (page - 1) * limit;
  const statusAlias =
    options.status && options.status !== 'all' ? options.status : null;

  const filterExpressions = [];
  if (statusAlias) {
    const status = await getStatusByAlias(statusAlias);
    filterExpressions.push({ status_id: status.id });
  }

  const searchClause = buildPlayerSearchClause(options.search);
  if (searchClause) {
    const literal = toLiteral(searchClause);
    if (literal) filterExpressions.push(literal);
  }

  const clubClause = buildClubFilterClause(options.clubIds);
  if (clubClause) {
    const literal = toLiteral(clubClause);
    if (literal) filterExpressions.push(literal);
  }

  const teamClause = buildTeamFilterClause(options.teamIds);
  if (teamClause) {
    const literal = toLiteral(teamClause);
    if (literal) filterExpressions.push(literal);
  }

  let where = {};
  if (filterExpressions.length === 1) {
    where = filterExpressions[0];
  } else if (filterExpressions.length > 1) {
    where = { [Op.and]: filterExpressions };
  }

  const baseResult = await PlayerPhotoRequest.findAndCountAll({
    attributes: ['id'],
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
    distinct: false,
    subQuery: false,
  });

  const total =
    typeof baseResult.count === 'number'
      ? baseResult.count
      : Array.isArray(baseResult.count)
        ? baseResult.count.length
        : 0;

  const ids = Array.isArray(baseResult.rows)
    ? baseResult.rows.map((row) => row.id)
    : [];

  if (!ids.length) {
    return { rows: [], count: total, page, pageSize: limit };
  }

  const dataRows = await PlayerPhotoRequest.findAll({
    where: { id: { [Op.in]: ids } },
    include: [
      {
        model: Player,
        as: 'Player',
        required: true,
        attributes: [
          'id',
          'external_id',
          'surname',
          'name',
          'patronymic',
          'date_of_birth',
        ],
        include: [
          {
            model: Club,
            as: 'Clubs',
            attributes: ['id', 'name'],
            through: { attributes: [] },
          },
          {
            model: Team,
            as: 'Teams',
            attributes: ['id', 'name', 'birth_year'],
            through: { attributes: [] },
          },
          {
            model: ExtFile,
            as: 'Photo',
            attributes: [
              'id',
              'external_id',
              'module',
              'name',
              'mime_type',
              'size',
              'object_status',
              'date_create',
              'date_update',
            ],
            required: false,
          },
        ],
      },
      {
        model: File,
        as: 'File',
        attributes: ['id', 'key', 'original_name', 'mime_type', 'size'],
      },
      {
        model: PlayerPhotoRequestStatus,
        as: 'Status',
        attributes: ['id', 'alias', 'name'],
      },
      {
        model: User,
        as: 'ReviewedBy',
        attributes: ['id', 'first_name', 'last_name', 'patronymic'],
      },
    ],
  });

  const orderMap = new Map(ids.map((id, index) => [String(id), index]));
  dataRows.sort((a, b) => {
    const aIdx = orderMap.get(String(a.id)) ?? 0;
    const bIdx = orderMap.get(String(b.id)) ?? 0;
    return aIdx - bIdx;
  });

  return {
    rows: dataRows,
    count: total,
    page,
    pageSize: limit,
  };
}

async function findById(id, options = {}) {
  return PlayerPhotoRequest.findByPk(id, {
    include: [
      {
        model: Player,
        as: 'Player',
        include: [
          {
            model: Club,
            as: 'Clubs',
            attributes: ['id', 'name'],
            through: { attributes: [] },
          },
          {
            model: Team,
            as: 'Teams',
            attributes: ['id', 'name', 'birth_year'],
            through: { attributes: [] },
          },
          {
            model: ExtFile,
            as: 'Photo',
            attributes: [
              'id',
              'external_id',
              'module',
              'name',
              'mime_type',
              'size',
              'object_status',
              'date_create',
              'date_update',
            ],
            required: false,
          },
        ],
      },
      { model: File, as: 'File' },
      {
        model: PlayerPhotoRequestStatus,
        as: 'Status',
      },
      {
        model: User,
        as: 'ReviewedBy',
        attributes: ['id', 'first_name', 'last_name', 'patronymic'],
      },
    ],
    transaction: options.transaction,
  });
}

async function approve({ requestId, actorId }) {
  return sequelize.transaction(async (tx) => {
    const request = await PlayerPhotoRequest.findByPk(requestId, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!request) {
      throw new ServiceError('photo_request_not_found', 404);
    }
    const pendingStatus = await getStatusByAlias(STATUS_ALIASES.PENDING, {
      transaction: tx,
    });
    if (String(request.status_id) !== String(pendingStatus.id)) {
      throw new ServiceError('photo_request_already_processed', 400);
    }
    const hydratedRequest = await PlayerPhotoRequest.findByPk(requestId, {
      transaction: tx,
      include: [
        {
          model: File,
          as: 'File',
          required: true,
          attributes: ['id', 'key', 'original_name', 'mime_type', 'size'],
        },
        {
          model: Player,
          as: 'Player',
          required: true,
          attributes: [
            'id',
            'external_id',
            'surname',
            'name',
            'patronymic',
            'date_of_birth',
            'photo_ext_file_id',
          ],
          include: [
            {
              model: ExtFile,
              as: 'Photo',
              required: false,
              paranoid: false,
              attributes: [
                'id',
                'external_id',
                'module',
                'name',
                'mime_type',
                'size',
                'object_status',
                'date_create',
                'date_update',
              ],
            },
          ],
        },
      ],
    });
    if (!hydratedRequest) {
      throw new ServiceError('photo_request_not_found', 404);
    }
    await processPlayerPhotoApproval({
      request: hydratedRequest,
      actorId,
      transaction: tx,
    });

    const approvedStatus = await getStatusByAlias(STATUS_ALIASES.APPROVED, {
      transaction: tx,
    });
    await request.update(
      {
        status_id: approvedStatus.id,
        reviewed_by: actorId,
        reviewed_at: new Date(),
        decision_reason: null,
        updated_by: actorId,
      },
      { transaction: tx }
    );
    return findById(request.id, { transaction: tx });
  });
}

async function reject({ requestId, actorId, reason }) {
  return sequelize.transaction(async (tx) => {
    const request = await PlayerPhotoRequest.findByPk(requestId, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!request) {
      throw new ServiceError('photo_request_not_found', 404);
    }
    const pendingStatus = await getStatusByAlias(STATUS_ALIASES.PENDING, {
      transaction: tx,
    });
    if (String(request.status_id) !== String(pendingStatus.id)) {
      throw new ServiceError('photo_request_already_processed', 400);
    }
    const rejectedStatus = await getStatusByAlias(STATUS_ALIASES.REJECTED, {
      transaction: tx,
    });
    await request.update(
      {
        status_id: rejectedStatus.id,
        reviewed_by: actorId,
        reviewed_at: new Date(),
        decision_reason: reason || null,
        updated_by: actorId,
      },
      { transaction: tx }
    );
    return findById(request.id, { transaction: tx });
  });
}

export default {
  submit,
  list,
  findById,
  approve,
  reject,
};
