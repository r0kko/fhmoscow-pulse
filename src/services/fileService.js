import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

import s3 from '../utils/s3Client.js';
import { S3_BUCKET } from '../config/s3.js';
import {
  File,
  MedicalCertificate,
  MedicalCertificateFile,
  MedicalCertificateType,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

async function uploadForCertificate(certId, file, typeAlias, actorId) {
  if (!S3_BUCKET) {
    throw new ServiceError('s3_not_configured', 500);
  }
  const cert = await MedicalCertificate.findByPk(certId);
  if (!cert) throw new ServiceError('certificate_not_found', 404);
  const type = await MedicalCertificateType.findOne({ where: { alias: typeAlias } });
  if (!type) throw new ServiceError('type_not_found', 400);

  const key = `${certId}/${uuidv4()}`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
  } catch (err) {
    console.error('S3 upload failed', err);
    throw new ServiceError('s3_upload_failed');
  }

  const dbFile = await File.create({
    key,
    original_name: file.originalname,
    mime_type: file.mimetype,
    size: file.size,
    created_by: actorId,
    updated_by: actorId,
  });

  const mcFile = await MedicalCertificateFile.create({
    medical_certificate_id: certId,
    file_id: dbFile.id,
    type_id: type.id,
    created_by: actorId,
    updated_by: actorId,
  });

  return MedicalCertificateFile.findByPk(mcFile.id, {
    include: [File, MedicalCertificateType],
  });
}

async function listForCertificate(certId) {
  return MedicalCertificateFile.findAll({
    where: { medical_certificate_id: certId },
    include: [File, MedicalCertificateType],
    order: [['created_at', 'DESC']],
  });
}

async function getDownloadUrl(file) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: file.key }),
    { expiresIn: 3600 }
  );
}

async function remove(id) {
  const file = await File.findByPk(id);
  if (!file) throw new ServiceError('file_not_found', 404);
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: file.key }));
  await MedicalCertificateFile.destroy({ where: { file_id: id } });
  await file.destroy();
}

export default { uploadForCertificate, listForCertificate, getDownloadUrl, remove };
