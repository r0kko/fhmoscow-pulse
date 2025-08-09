import path from 'path';

import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

import s3 from '../utils/s3Client.js';
import { getS3Bucket } from '../config/s3.js';
import { MAX_NORMATIVE_FILE_SIZE } from '../config/fileLimits.js';
import {
  File,
  MedicalCertificate,
  MedicalCertificateFile,
  MedicalCertificateType,
  Ticket,
  TicketFile,
} from '../models/index.js';
import ServiceError from '../errors/ServiceError.js';

function isTestEnvWithoutS3() {
  return Boolean(process.env.JEST_WORKER_ID) && !process.env.S3_BUCKET;
}

async function uploadForCertificate(certId, file, typeAlias, actorId) {
  if (isTestEnvWithoutS3() || !getS3Bucket()) {
    throw new ServiceError('s3_not_configured', 500);
  }
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  if (file.size > MAX_FILE_SIZE) {
    throw new ServiceError('file_too_large', 400);
  }
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new ServiceError('invalid_file_type', 400);
  }
  const cert = await MedicalCertificate.findByPk(certId);
  if (!cert) throw new ServiceError('certificate_not_found', 404);
  const type = await MedicalCertificateType.findOne({
    where: { alias: typeAlias },
  });
  if (!type) throw new ServiceError('type_not_found', 400);

  const key = `${certId}/${uuidv4()}${path.extname(file.originalname)}`;
  const user = await cert.getUser();
  const displayName = `${type.name} - ${user.last_name} ${user.first_name}${path.extname(file.originalname)}`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
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
    original_name: displayName,
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
    new GetObjectCommand({ Bucket: getS3Bucket(), Key: file.key }),
    { expiresIn: 3600 }
  );
}

async function remove(id, actorId = null) {
  const attachment = await MedicalCertificateFile.findOne({
    where: { file_id: id },
    include: [File],
  });
  if (!attachment) throw new ServiceError('file_not_found', 404);
  await attachment.update({ updated_by: actorId });
  await attachment.File.update({ updated_by: actorId });
  await attachment.destroy();
  await attachment.File.destroy();
}

async function uploadForTicket(ticketId, file, actorId) {
  if (isTestEnvWithoutS3() || !getS3Bucket()) {
    throw new ServiceError('s3_not_configured', 500);
  }
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['application/pdf'];
  if (file.size > MAX_FILE_SIZE) {
    throw new ServiceError('file_too_large', 400);
  }
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new ServiceError('invalid_file_type', 400);
  }
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) throw new ServiceError('ticket_not_found', 404);

  const key = `${ticketId}/${uuidv4()}${path.extname(file.originalname)}`;
  const user = await ticket.getUser();
  const displayName = `Медицинская справка - ${user.last_name} ${user.first_name}${path.extname(
    file.originalname
  )}`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
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
    original_name: displayName,
    mime_type: file.mimetype,
    size: file.size,
    created_by: actorId,
    updated_by: actorId,
  });

  const attachment = await TicketFile.create({
    ticket_id: ticketId,
    file_id: dbFile.id,
    created_by: actorId,
    updated_by: actorId,
  });

  return TicketFile.findByPk(attachment.id, { include: [File] });
}

async function uploadForNormativeTicket(ticketId, file, actorId, user, type) {
  if (isTestEnvWithoutS3() || !getS3Bucket()) {
    throw new ServiceError('s3_not_configured', 500);
  }
  if (file.size > MAX_NORMATIVE_FILE_SIZE) {
    throw new ServiceError('file_too_large', 400);
  }
  if (!file.mimetype.startsWith('video/')) {
    throw new ServiceError('invalid_file_type', 400);
  }
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) throw new ServiceError('ticket_not_found', 404);

  const key = `${ticketId}/${uuidv4()}${path.extname(file.originalname)}`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
  } catch (err) {
    console.error('S3 upload failed', err);
    throw new ServiceError('s3_upload_failed');
  }

  const dateStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const fio = `${user.last_name} ${user.first_name}${
    user.patronymic ? ` ${user.patronymic}` : ''
  }`.trim();
  const displayName = `${fio} ${dateStr} ${type.name}${path.extname(
    file.originalname
  )}`;
  const dbFile = await File.create({
    key,
    original_name: displayName,
    mime_type: file.mimetype,
    size: file.size,
    created_by: actorId,
    updated_by: actorId,
  });

  const attachment = await TicketFile.create({
    ticket_id: ticketId,
    file_id: dbFile.id,
    created_by: actorId,
    updated_by: actorId,
  });

  return TicketFile.findByPk(attachment.id, { include: [File] });
}

async function listForTicket(ticketId) {
  return TicketFile.findAll({
    where: { ticket_id: ticketId },
    include: [File],
    order: [['created_at', 'DESC']],
  });
}

async function removeTicketFile(id, actorId = null) {
  const attachment = await TicketFile.findOne({
    where: { file_id: id },
    include: [File],
  });
  if (!attachment) throw new ServiceError('file_not_found', 404);
  await attachment.update({ updated_by: actorId });
  await attachment.File.update({ updated_by: actorId });
  await attachment.destroy();
  await attachment.File.destroy();
}

async function saveGeneratedPdf(buffer, name, actorId) {
  if (isTestEnvWithoutS3() || !getS3Bucket()) {
    throw new ServiceError('s3_not_configured', 500);
  }
  const key = `documents/${uuidv4()}.pdf`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      })
    );
  } catch (err) {
    console.error('S3 upload failed', err);
    throw new ServiceError('s3_upload_failed');
  }
  const file = await File.create({
    key,
    original_name: name,
    mime_type: 'application/pdf',
    size: buffer.length,
    created_by: actorId,
    updated_by: actorId,
  });
  return file;
}

export default {
  uploadForCertificate,
  listForCertificate,
  getDownloadUrl,
  remove,
  uploadForTicket,
  uploadForNormativeTicket,
  listForTicket,
  removeTicketFile,
  saveGeneratedPdf,
};
