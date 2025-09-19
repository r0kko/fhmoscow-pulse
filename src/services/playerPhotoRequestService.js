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

const STATUS_ALIASES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const statusCache = new Map();

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
          alias: {
            [Op.in]: [STATUS_ALIASES.PENDING, STATUS_ALIASES.APPROVED],
          },
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
    const result = await sequelize.transaction(async (tx) => {
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

    return result;
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

  const playerWhere = {};
  if (options.search) {
    const term = `%${options.search}%`;
    playerWhere[Op.or] = [
      { surname: { [Op.iLike]: term } },
      { name: { [Op.iLike]: term } },
      { patronymic: { [Op.iLike]: term } },
    ];
  }

  const include = [
    {
      model: Player,
      as: 'Player',
      required: true,
      where: playerWhere,
      include: [
        {
          model: Club,
          as: 'Clubs',
          attributes: ['id', 'name'],
          through: { attributes: [] },
          required: Boolean(options.clubIds?.length),
          where: options.clubIds?.length
            ? { id: { [Op.in]: options.clubIds } }
            : undefined,
        },
        {
          model: Team,
          as: 'Teams',
          attributes: ['id', 'name', 'birth_year'],
          through: { attributes: [] },
          required: Boolean(options.teamIds?.length),
          where: options.teamIds?.length
            ? { id: { [Op.in]: options.teamIds } }
            : undefined,
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
      required: true,
      where: statusAlias ? { alias: statusAlias } : undefined,
    },
    {
      model: User,
      as: 'ReviewedBy',
      attributes: ['id', 'first_name', 'last_name', 'patronymic'],
    },
  ];

  const result = await PlayerPhotoRequest.findAndCountAll({
    where: {},
    include,
    order: [['created_at', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return { ...result, page, pageSize: limit };
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
