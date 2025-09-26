import logger from '../../logger.js';
import ServiceError from '../errors/ServiceError.js';
import {
  deleteExternalFileById,
  insertExternalFileRecord,
  updateExternalFileName,
  updateExternalPlayerPhotoId,
} from '../config/externalMariaDb.js';
import ExtFile from '../models/extFile.js';
import { getModuleStoragePath } from '../config/extFiles.js';

import externalFileStorageService from './externalFileStorageService.js';
import fileService from './fileService.js';

const PLAYER_PHOTO_MODULE = 'playerPhoto';

function resolveFileExtension(file) {
  const mime = (file?.mime_type || '').toLowerCase();
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  const original = (file?.original_name || '').toLowerCase();
  if (original.endsWith('.png')) return '.png';
  if (original.endsWith('.webp')) return '.webp';
  return '.jpg';
}

function buildStorageKey(fileName) {
  const modulePath = getModuleStoragePath(PLAYER_PHOTO_MODULE);
  if (!modulePath) {
    throw new ServiceError('external_module_path_unresolved', 500);
  }
  return `${modulePath}/${fileName}`.replace(/\\/g, '/');
}

async function upsertLocalExtFile({ externalFile, fileMeta, transaction }) {
  let local = await ExtFile.findOne({
    where: { external_id: externalFile.id },
    paranoid: false,
    transaction,
  });
  const payload = {
    module: PLAYER_PHOTO_MODULE,
    name: fileMeta.relativeName,
    mime_type: fileMeta.mimeType,
    size: fileMeta.size,
    object_status: externalFile.object_status,
    date_create: externalFile.date_create,
    date_update: externalFile.date_update,
  };
  if (!local) {
    local = await ExtFile.create(
      {
        external_id: externalFile.id,
        ...payload,
      },
      { transaction }
    );
    return local;
  }
  if (local.deletedAt) {
    await local.restore({ transaction });
  }
  await local.update(payload, { transaction });
  return local;
}

export async function processPlayerPhotoApproval({
  request,
  actorId,
  transaction,
}) {
  if (!request) throw new ServiceError('photo_request_not_found', 404);
  const file = request.File;
  const player = request.Player;
  if (!file) throw new ServiceError('photo_request_file_missing', 500);
  if (!player) throw new ServiceError('photo_request_player_missing', 500);
  if (player.external_id == null || Number.isNaN(Number(player.external_id))) {
    throw new ServiceError('player_missing_external_id', 422);
  }

  const previousExternalPhotoId =
    player.Photo?.external_id == null ? null : Number(player.Photo.external_id);

  const buffer = await fileService.getFileBuffer(file);
  const ext = resolveFileExtension(file);

  let finalName = null;
  let storageKey = null;
  let uploadedKey = null;
  let externalFile = null;
  try {
    externalFile = await insertExternalFileRecord({
      module: PLAYER_PHOTO_MODULE,
      mimeType: file.mime_type,
      size: file.size,
      name: null,
      objectStatus: 'active',
    });

    finalName = `${externalFile.id}${ext}`;
    storageKey = buildStorageKey(finalName);

    const uploadResult = await externalFileStorageService.uploadBuffer({
      key: storageKey,
      body: buffer,
      contentType: file.mime_type,
    });
    uploadedKey = uploadResult.key;

    await updateExternalFileName({
      fileId: externalFile.id,
      name: finalName,
    });
    externalFile.name = finalName;
    externalFile.date_update = new Date();

    await updateExternalPlayerPhotoId({
      playerId: player.external_id,
      fileId: externalFile.id,
    });

    const localExtFile = await upsertLocalExtFile({
      externalFile,
      fileMeta: {
        relativeName: finalName,
        mimeType: file.mime_type,
        size: file.size == null ? null : Number(file.size),
      },
      transaction,
    });

    await player.update(
      { photo_ext_file_id: localExtFile.id },
      { transaction }
    );
    player.Photo = localExtFile;
    player.photo_ext_file_id = localExtFile.id;

    logger.info(
      'Approved player photo synced externally: player=%s externalFile=%s key=%s actor=%s',
      player.external_id,
      externalFile.id,
      uploadedKey,
      actorId || 'system'
    );

    return {
      externalFile,
      localExtFile,
      storageKey: uploadedKey,
      relativeName: finalName,
      previousExternalPhotoId,
    };
  } catch (err) {
    if (externalFile?.id) {
      try {
        await updateExternalPlayerPhotoId({
          playerId: player.external_id,
          fileId: previousExternalPhotoId,
        });
      } catch (restoreErr) {
        console.warn(
          'Failed to restore external player photo_id for player %s: %s',
          player.external_id,
          restoreErr?.message
        );
      }
      try {
        await deleteExternalFileById(externalFile.id);
      } catch (deleteErr) {
        console.warn(
          'Failed to cleanup external file %s after approval error: %s',
          externalFile.id,
          deleteErr?.message
        );
      }
    }
    if (uploadedKey) {
      await externalFileStorageService.removeObject({ key: uploadedKey });
    }
    throw err;
  }
}

export default {
  processPlayerPhotoApproval,
};
